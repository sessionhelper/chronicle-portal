# ttrpg-collector-frontend

> Org-wide conventions live in `/home/alex/sessionhelper-hub/CLAUDE.md`. The full **Parchment design system** + **Uncodixfy UI rules** live in `/home/alex/sessionhelper-hub/design/uncodixfy-ui.md` — read that before any UI work.

Participant portal for the Open Voice Project. Users whose voice was recorded in TTRPG sessions log in via Discord OAuth, review their sessions, edit transcripts, flag private info, manage consent, and export/delete their data. Talks to a Rust (Axum) backend.

## Stack

- **Next.js 15** + **React 19** (App Router)
- **TypeScript**, strict mode
- **Tailwind CSS 4** (PostCSS)
- **Shadcn/ui** — cherry-picked Radix primitives only: Dialog, Button, Badge, Input, RadioGroup, Toast, Tooltip, DropdownMenu
- **Sonner** for toasts
- **Lucide** for icons
- **react-markdown** for markdown rendering
- No external state management — plain React `useState` / `useContext`
- No form library — controlled inputs

## Layout

```
src/
  app/                     # Next.js App Router
    page.tsx               # Landing
    layout.tsx             # Root layout
    globals.css            # Tailwind + theme
    auth/discord/          # OAuth redirect + callback
    dashboard/             # Protected routes (middleware auth guard)
      page.tsx             # Session list
      sessions/[id]/       # Session detail + transcript viewer
      settings/            # Global opt-out, export, deletion
      audit/               # Audit log
  components/
    layout/                # Nav, footer, dashboard shell
    ui/                    # Shadcn primitives
    transcript/            # Transcript viewer, segment rows, editor, flags
  hooks/
    useAuth.ts             # Current user fetch + cache
    useTranscript.ts       # Segments, flagging, editing with optimistic updates
    useAudioPlayback.ts    # Per-clip + full-session playback, segment sync
    usePolling.ts          # Generic poller (used for data export status)
  lib/
    api-client.ts          # Centralized REST client, grouped by domain
    types.ts               # TypeScript interfaces for all API types
    format.ts              # Date / duration / time formatters
  middleware.ts            # Auth guard for /dashboard/*
```

## Repo-specific conventions

- `"use client"` at the top of any interactive component.
- API client pattern: `api.domain.action()`. No direct fetches outside `src/lib/api-client.ts`.
- Dynamic routes: `[paramName]` directories.
- File uploads use `FormData` against `NEXT_PUBLIC_BACKEND_URL` directly to bypass Next.js body size limits.
- Server-side auth derivation: `is_own_line` and `can_edit` come from the backend per segment. Never compute edit permission client-side.
- Optimistic updates on transcript flag/edit; revert on failure.
- Full-session playback polls `currentTime` every 200ms to sync the active transcript segment.

## Backend integration

- Backend is **Rust/Axum**, not Python.
- Dev: Next.js rewrites proxy `/api/*` → `BACKEND_URL` (default `http://localhost:8000`).
- Direct backend URL via `NEXT_PUBLIC_BACKEND_URL` for file uploads.
- REST verbs: `GET` read, `POST` create, `PATCH` update, `DELETE` remove.

## Env vars

| Var | Required | Default |
|---|---|---|
| `BACKEND_URL` | no | `http://localhost:8000` |
| `NEXT_PUBLIC_BACKEND_URL` | no | same as `BACKEND_URL` |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | yes | — |
| `NEXT_PUBLIC_DISCORD_REDIRECT_URI` | no | `http://localhost:3000/auth/discord/callback` |

## Build / run

```bash
npm install
npm run dev        # port 3000
npm run build
npm run lint
```

## Design notes (tl;dr — see hub `design/uncodixfy-ui.md` for the full ruleset)

- **Parchment palette**: background `#f5f0e8`, accent `#8b4513` (saddle brown), text `#2c2416`. Warm editorial, no blue-tinted "premium dark mode".
- **Typography**: Crimson Pro (serif) for headings/body, Inter (sans) for nav/metadata/tables.
- **Layout**: centered max-width 660–720px, single column below 640px. No hero sections inside dashboards.
- **Components**: 4px radius on cards/buttons, 1px borders, shadows under 8px blur, transitions 100–200ms opacity/color only.
- **Banned**: glassmorphism, gradients on buttons, pill shapes, oversized rounded corners (20–32px), eyebrow labels, `<small>` headers, decorative copy.
