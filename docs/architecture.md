# chronicle-portal — Architecture

## System overview

chronicle-portal is the participant portal and transcript viewer for
the Open Voice Project (OVP). Participants log in via Discord OAuth,
browse their sessions, watch transcripts arrive in real time as the
worker transcribes them, play back mixed audio for any time range, and
(eventually) correct or flag segments. This is the user-facing surface
of the Chronicle toolchain — the only component players interact with
directly.

The frontend is a Next.js 15 / React 19 app that runs its own BFF layer
in `src/app/api/*`. The BFF talks directly to `chronicle-data-api` using the
shared-secret auth protocol — there is no separate Axum public API in
front of it.

## Service architecture

```
                       Browser
                          │
                          │  HTTPS
                          ▼
             ┌──────────────────────────┐
             │  Next.js 15 (App Router) │
             │                          │
             │  pages/components ──┐    │
             │                     │    │
             │  src/app/api/* ─────┼──► │  "BFF" — server-only
             │  (server routes)    │    │  - authenticates to data-api
             │                     │    │  - forwards / proxies
             │                     │    │
             │  src/lib/data-api.ts     │  Data API client (server)
             │  src/lib/api-client.ts   │  Thin wrapper for browser code
             └──────────────┬───────────┘
                            │
                            │ HTTP (Bearer, shared-secret-issued)
                            │ WS  (SSE bridge — event fanout)
                            ▼
                      chronicle-data-api
                      (127.0.0.1:8001)
```

The BFF is the only thing that holds the shared secret. Browser code
never sees it — mutations and reads all go through `src/app/api/*`
routes, which in turn use `src/lib/data-api.ts` to talk to the data-api.

## Key design decisions

- **BFF-only — no separate public API.** Everything the frontend needs
  is exposed under `/api/*` in the Next.js app, and the BFF forwards to
  the internal data-api. This keeps a single source of truth for
  authorization and avoids maintaining a separate Rust gateway.
- **Real-time via SSE bridge to WebSocket.** `src/app/api/events/route.ts`
  opens a WebSocket to the data-api event bus, subscribes to the
  requested session's topic, and forwards events to the browser as
  Server-Sent Events. SSE instead of WS for browser-side because the
  browser only needs one-way push and SSE integrates more cleanly with
  Next.js route handlers.
- **Server-side audio mixing.** The old approach downloaded all
  per-speaker PCM chunks to the browser and mixed in JavaScript; that
  has been replaced by a BFF proxy to
  `GET /internal/sessions/{id}/audio/mixed`, which mixes speakers on
  the data-api side and returns a contiguous WAV (Opus encoding is a
  planned fallback). The playback hook fetches small windows on demand.
- **Chunk events are internal.** `chunk_uploaded` events flow through
  the data-api event bus but the SSE bridge filters them out before
  forwarding to the browser — only the worker needs them.

## Tech stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| UI runtime | React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Component primitives | Shadcn/ui (Radix UI) |
| Server runtime | Node.js (for `ws` / `next` API routes) |
| Data source | `chronicle-data-api` (Rust/Axum, HTTP + WS) |

## Source layout

```
src/
├── app/
│   ├── layout.tsx               — Root layout
│   ├── page.tsx                 — Marketing / landing
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx             — Session list
│   │   └── sessions/[id]/
│   │       ├── layout.tsx
│   │       ├── page.tsx         — Session detail shell
│   │       └── transcript/
│   │           └── page.tsx     — Transcript + playback view
│   ├── sessions/
│   │   ├── page.tsx             — Session index (legacy/alt nav)
│   │   └── [id]/page.tsx        — Session detail + transcript viewer
│   └── api/                     — BFF server routes
│       ├── health/route.ts
│       ├── events/route.ts      — SSE bridge to data-api WS event bus
│       └── sessions/
│           ├── route.ts
│           └── [id]/
│               ├── route.ts             — Session metadata
│               ├── segments/route.ts    — Transcript fetch
│               ├── participants/route.ts
│               ├── beats/route.ts
│               ├── scenes/route.ts
│               └── audio/route.ts       — Proxy to /audio/mixed
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx        — Sidebar + main content shell
│   │   ├── sidebar.tsx
│   │   ├── dashboard-shell.tsx
│   │   └── nav.tsx
│   ├── transcript/
│   │   ├── transcript-list.tsx
│   │   ├── segment-row.tsx
│   │   ├── segment-editor.tsx
│   │   ├── flagged-segment.tsx
│   │   └── playback-controls.tsx
│   └── ui/                      — Shadcn primitives
├── hooks/
│   ├── use-session-events.ts    — EventSource subscription helper
│   ├── use-audio-playback.ts    — Windowed audio fetch + playback
│   ├── use-transcript.ts
│   ├── use-polling.ts
│   └── use-auth.ts              — Auth stub (OAuth integration WIP)
└── lib/
    ├── data-api.ts              — Server-side data-api client (holds the secret)
    ├── api-client.ts            — Browser-safe wrapper
    ├── types.ts
    ├── format.ts
    └── utils.ts
```

## Real-time: SSE bridge to data-api event bus

`src/app/api/events/route.ts` opens an EventSource-compatible SSE stream
that is backed by a server-side WebSocket connection to the data-api.

Flow per browser connection:

```
EventSource("/api/events?session_id=<uuid>")
        │
        ▼
src/app/api/events/route.ts
  1. POST /internal/auth (shared secret)
  2. Open ws://data-api/ws?token=<service_token>
  3. Send {"subscribe": "sessions/<uuid>"}
  4. Forward incoming events as SSE, EXCEPT:
       - `chunk_uploaded` (internal only, dropped)
```

Events the browser may see:

- `connected` — emitted by the BFF as soon as the WS is ready
- `session_status_changed`
- `segment_added`
- `segments_batch_added`
- `beat_detected`
- `scene_detected`
- `transcription_progress`
- `disconnected` — upstream closed
- `error` — upstream error

The browser hooks in `use-session-events` consume these events and
update React state so transcript rows appear as they are transcribed.

## Audio playback

`src/hooks/use-audio-playback.ts` implements a windowed chunk-on-demand
approach. The BFF route `src/app/api/sessions/[id]/audio/route.ts`
proxies to `GET /internal/sessions/{id}/audio/mixed?start=X&end=Y&format=…`.

Three playback modes:

| Mode | Method | Behaviour |
|------|--------|-----------|
| Segment | `playSegment(start, end)` | Fetches the exact `[start, end]` window and plays just that range. Used when clicking a transcript line. |
| Continuous | `playFrom(time)` | Fetches a `WINDOW_SIZE`-second window (default 30 s), starts playback, and pre-fetches the next window 5 seconds before the current one ends. |
| Seek | `seek(time)` | If the target time is already covered by the current window, seeks within it. Otherwise computes the enclosing window, fetches it, and resumes playback there. |

The data-api mixer currently returns WAV regardless of `format` (Opus
encoding is a TODO on the data-api side). The hook keeps the `format=opus`
request parameter so switching over is transparent when that lands.

## Data model — what the frontend sees

All reads go through the data-api via the BFF. The frontend doesn't
own a database. Types in `src/lib/data-api.ts` and `src/lib/types.ts`
mirror the data-api responses:

- **Session** — id, guild_id, started_at, ended_at, status, title,
  participant_count, segment_count, etc.
- **Participant (with user pseudo_id)** — id, session_id, user_pseudo_id,
  display_name, character_name, consent_scope, `no_llm_training` bool,
  `no_public_release` bool. The two license flags are independent
  booleans that compose into the four-corner license matrix (see
  `../README.md` § Data license flags). Display name, character name,
  and both license flags are supported on the data-api side (PATCH
  `/internal/participants/{id}`, PATCH `/internal/participants/{id}/license`)
  but are not yet surfaced in the portal UI.
- **Segment** — segment_index, speaker_pseudo_id, start_time, end_time,
  text, original_text, confidence, chunk_group, excluded.
- **Beat** / **Scene** — optional, produced by the LLM operators in the
  pipeline.

## Auth status

Discord OAuth is scaffolded in `src/hooks/use-auth.ts` and referenced in
`sessionhelper-hub/docs/auth-proxy-plan.md`, but the current build runs
without a login gate for the dev portal. The plan is to drop Auth.js v5
into Next.js and let the BFF enforce per-user scoping on data-api calls.
Until then the portal treats any reachable client as authorized, which
is fine on the 127.0.0.1-only dev deployment.

## Transcript display: speaker lanes

TTRPG sessions have constant crosstalk — multiple speakers talking
simultaneously. Segments have per-speaker `start_time` / `end_time`
ranges that overlap.

The transcript viewer renders as **speaker lanes**: overlapping segments
are laid out in side-by-side columns so interruptions and reactions are
visually obvious. The audio playback cursor walks through all lanes
simultaneously, highlighting the active segment(s) per speaker. This is
distinct from a flat chat-log view — the lane layout preserves the
temporal reality of who was talking when.

## Deployment

- Next.js runs as a Node.js container in the OVP compose stack.
- BFF is bound to the same container; browser traffic goes through the
  compose stack's reverse proxy.
- `DATA_API_URL` and `DATA_API_SHARED_SECRET` are injected via env.
- Compose stacks live in `sessionhelper-hub/infra/`.
