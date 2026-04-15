# chronicle-portal

> Org-wide conventions live in `/home/alex/sessionhelper-hub/CLAUDE.md`.
> Authoritative spec: `/home/alex/sessionhelper-hub/docs/modules/chronicle-portal.md`.

Next.js app with a BFF layer in front of the Rust data-api. Three role surfaces (admin / GM / player) on one codebase. The BFF is the security boundary — the browser never sees `DATA_API_URL`.

## Stack

- **Next.js 15** (App Router, server actions)
- **React 19**
- **TypeScript** strict
- **Auth.js v5** (Discord provider, JWT strategy, 7-day TTL)
- **Tailwind 3 + shadcn/ui** (Radix primitives)
- **Zod** for BFF body validation and data-api parsing
- **prom-client** for metrics at `/api/metrics`
- **OpenTelemetry SDK** registered via `instrumentation.ts`
- `ws` for the single portal → data-api WebSocket subscription

## Layout

```
src/
  app/
    page.tsx                      # landing (public)
    login/page.tsx                # Auth.js entry
    dashboard/page.tsx            # signed-in home
    sessions/page.tsx             # session list
    sessions/[id]/page.tsx        # detail + playback + transcript
    me/page.tsx                   # consent, license, delete-my-audio
    admin/page.tsx                # user list + is_admin toggles
    api/
      auth/[...nextauth]/         # Auth.js mount
      health/                     # liveness
      metrics/                    # prom-client scrape
      sessions/                   # list, detail, summary, segments, events (SSE), audio
      segments/[id]/              # text edits
      me/sessions/[id]/           # consent, license, delete-my-audio
      admin/users/                # admin toggles
  components/
    app-shell.tsx                 # server-rendered chrome
    session-live-badge.tsx        # SSE-driven 🔴 recording badge
    segment-list.tsx              # transcript rows + inline editor
    me/*.tsx                      # ConsentForm, LicenseSwitches, DeleteMyAudio
    admin/user-row.tsx            # is_admin toggle
    sign-in-button.tsx / sign-out-button.tsx
    ui/*.tsx                      # shadcn primitives
  lib/
    auth.ts                       # next-auth config + signIn/signOut exports
    server-auth.ts                # resolveUser, requireUser, requireAdmin, requireSessionAccess
    data-api-client.ts            # process-wide DataApiClient singleton
    event-bus.ts                  # WS subscription + SSE fan-out
    filters.ts                    # role-based response filtering
    api-handler.ts                # apiHandler() wrapper + parseJson()
    page-data.ts                  # shared server-component data fetchers
    metrics.ts                    # prom-client registry
    env.ts                        # single source of truth for process.env
    utils.ts                      # cn(), formatters
    schemas/
      data-api.ts                 # Zod for data-api shapes
      bff.ts                      # Zod for BFF request bodies
  middleware.ts                   # Auth.js gate for /dashboard, /sessions, /me, /admin
  types/next-auth.d.ts            # module augmentation
instrumentation.ts                # OpenTelemetry SDK init
```

## Conventions

- **BFF boundary rule:** React components never call the data-api directly; they only call `/api/*`. Server components can call `dataApiClient` + `page-data` helpers directly because they're already server-side.
- **Happy-path handlers:** every BFF route wraps its logic in `apiHandler(route, async (req, { params }) => { ... })`. The wrapper centralises error → HTTP translation. Handlers throw `AuthError(status, msg)` / `ZodError` — no per-handler status guards.
- **Authorization choke points:** `requireUser()`, `requireAdmin()`, `requireSessionAccess()`. Role is derived per-request from data-api state, never trusted from the JWT beyond identity.
- **PATCH bodies:** strict Zod schemas. `author_service` / `author_user_pseudo_id` / state-machine fields are never accepted from the client — the BFF sets them.
- **Metrics:** emitted from `apiHandler` and `DataApiClient`. New route = free metric.

## Run

```bash
npm install
cp .env.example .env.local        # fill in Discord + SHARED_SECRET
npm run dev                       # :3000
npm run build
npm run lint
npm test                          # vitest unit tests for BFF + schemas
npm run test:e2e                  # Playwright smoke (needs dev-server + data-api)
```

## Env

See `.env.example`. Required at runtime:
`DATA_API_URL`, `SHARED_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.
