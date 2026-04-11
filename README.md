# chronicle-portal

Next.js participant portal for the Chronicle toolchain. Discord OAuth
login, per-speaker session review, transcript editing, audio playback
over time ranges, and consent / data-deletion controls for players in
recorded sessions.

This is the user-facing face of OVP. It's where a player who consented
to a session getting recorded reviews what was captured, corrects the
transcript, flags private info, and exercises their opt-out / delete
rights before segments enter the dataset candidate set.

## Stack

- **Next.js 15 / React 19** app router
- **TypeScript** throughout
- **Discord OAuth** for player login (no other auth method)
- **BFF pattern**: `src/app/api/*` routes run server-side in Next and
  call `chronicle-data-api` directly using the shared-secret service
  auth. There is no separate Rust public API in front — the portal is
  the only thing that talks to the data-api on the user path.
- **SSE bridge**: BFF routes subscribe to the data-api WebSocket and
  fan out events to connected browser clients over Server-Sent Events
- **Windowed audio playback**: audio is never bulk-downloaded. The
  player UI streams PCM chunks from S3 on demand for whatever time
  range the user is scrubbing through.

## Role in the stack

```
┌─────────────┐
│   Player    │  (Discord OAuth)
└──────┬──────┘
       │ HTTPS
       ▼
┌──────────────────────────────────┐
│       chronicle-portal           │
│  ┌────────────────────────────┐  │
│  │ Next.js client (React 19)  │  │
│  └────────────┬───────────────┘  │
│               │                  │
│  ┌────────────▼───────────────┐  │
│  │ BFF: src/app/api/* routes  │  │
│  │  - Discord OAuth flow      │  │
│  │  - Session-scoped auth     │  │
│  │  - Proxies to data-api     │  │
│  │  - SSE bridge              │  │
│  └────────────┬───────────────┘  │
└───────────────┼──────────────────┘
                │ Shared-secret bearer
                ▼
      ┌──────────────────────┐
      │ chronicle-data-api   │
      │ (127.0.0.1:8001)     │
      └──────────────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for the full BFF
design, auth flow, and audio playback strategy.

## Data license flags

Every session segment carries two independent flags per speaker, set
from the portal's consent UI:

| `no_llm_training` | `no_public_release` | Published? | LLM training? | License |
|---|---|---|---|---|
| false | false | Yes (`ovp-open`) | Yes | CC BY-SA 4.0 |
| true | false | Yes (`ovp-rail`) | No | CC BY-SA 4.0 + RAIL addendum |
| false | true | No | Yes (internal only) | Internal use |
| true | true | No | No | Fully restricted |

Defaults: both false (fully open). Players can toggle either flag at
any time on the session detail page. See `docs/architecture.md`
§ Data Licensing for the full consent flow.

## Quick start

```bash
cp .env.example .env
# Edit .env — add DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DATA_API_URL,
# DATA_API_SHARED_SECRET
npm install
npm run dev
```

The dev server runs on `http://localhost:3000`. Discord OAuth callbacks
assume `http://localhost:3000/api/auth/callback` is configured in the
Discord developer portal.

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `DISCORD_CLIENT_ID` | yes | Discord OAuth application ID |
| `DISCORD_CLIENT_SECRET` | yes | Discord OAuth application secret |
| `DATA_API_URL` | yes | Base URL for chronicle-data-api (e.g. `http://localhost:8001`) |
| `DATA_API_SHARED_SECRET` | yes | Service auth token (see `sessionhelper-hub/CLAUDE.md`) |
| `NEXT_PUBLIC_URL` | no | Public URL for this app (used for OAuth callback construction) |

## Structure

```
src/
  app/
    page.tsx                 -- landing page
    sessions/
      page.tsx               -- session list (participant view)
      [id]/
        page.tsx             -- session detail, transcript, audio scrubber
    api/
      auth/                  -- Discord OAuth BFF routes
      sessions/              -- session data BFF routes (proxies to data-api)
      events/                -- SSE bridge to data-api WebSocket
  lib/
    data-api.ts              -- shared-secret client for chronicle-data-api
```

## Design system

UI rules live in
[`sessionhelper-hub/design/uncodixfy-ui.md`](https://github.com/sessionhelper/sessionhelper-hub/blob/main/design/uncodixfy-ui.md):
warm, editorial, honest — Linear / Raycast / Stripe territory, not
generic AI dashboard. The Parchment palette is shared across all
user-facing Chronicle surfaces.

## Related

- [`chronicle-data-api`](https://github.com/sessionhelper/chronicle-data-api) — the only backend this portal talks to
- [`sessionhelper-hub/ARCHITECTURE.md`](https://github.com/sessionhelper/sessionhelper-hub/blob/main/ARCHITECTURE.md) — cross-service data flow
- [`sessionhelper-hub/SPEC.md`](https://github.com/sessionhelper/sessionhelper-hub/blob/main/SPEC.md) — OVP program spec (this portal delivers G2)
- [`sessionhelper-hub/design/uncodixfy-ui.md`](https://github.com/sessionhelper/sessionhelper-hub/blob/main/design/uncodixfy-ui.md) — UI conventions
