# Architecture

## System Overview

The TTRPG Collector (Open Voice Project) is a participant portal where people whose voice was recorded in TTRPG sessions can manage consent, review transcripts, flag private information, and correct ASR output. Transcript corrections produce free training data as `(audio, machine_text, human_text)` triples.

## Service Architecture

```
                                Internet
                                   │
                               ┌───┴───┐
                               │ Caddy  │  ← auto TLS via Let's Encrypt
                               └───┬───┘
                          ┌────────┴────────┐
                          │                  │
                     /api/*             everything else
                          │                  │
                 ┌────────┴───┐    ┌─────────┴──────┐
                 │ Rust API   │    │ Next.js         │
                 │ (Axum)     │    │ :3000           │
                 │ :8000      │    └────────────────┘
                 └────────┬───┘
                          │
Discord Bot (Songbird) ──┼──→ Postgres
                          │
                          └──→ S3 (FLAC + JSON)
```

### Components

| Component | Technology | Role |
|-----------|-----------|------|
| **Reverse proxy** | Caddy | Auto Let's Encrypt TLS. Routes `/api/*` → Axum, everything else → Next.js |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Shadcn/ui (Radix) | Participant portal — session list, transcript review, consent management |
| **API** | Rust (Axum) | REST API for frontend. Auth, session queries, transcript serving, consent mutations, audio streaming |
| **Discord bot** | Rust (Serenity + Songbird) | Records per-speaker audio from Discord voice channels with DAVE E2EE. Writes to Postgres + S3 |
| **Database** | PostgreSQL | Source of truth for sessions, participants, consent, transcripts, flags, edits |
| **Object storage** | S3-compatible (Hetzner) | Archival storage for FLAC audio + JSON metadata. Bot writes, API reads |
| **Transcription** | Rust streaming pipeline (planned) | VAD → Whisper → hallucination filter → segments in Postgres |

### Key Design Decisions

- **Bot and API are separate binaries** sharing Postgres. Bot writes session/consent data. API reads it for the frontend and handles consent mutations.
- **S3 is archival, Postgres is operational.** Bot writes to both. If Postgres is down, bot continues with S3 (backfillable). API reads from Postgres only.
- **Frontend never sees pseudo_ids.** The API derives `is_own_line` and `can_edit` server-side per segment.
- **No account creation for non-participants.** Discord OAuth succeeds but if the user has no `session_participants` rows, they see "No recorded sessions." Prevents account spam.

## Authentication

Discord OAuth2 with minimal `identify` scope (username + ID only).

```
User → "Sign in with Discord" → Discord OAuth → callback with code
  → API exchanges code for Discord token → calls /users/@me → gets Discord user ID
  → derives pseudo_id via SHA256(user_id) → finds/creates user in Postgres
  → issues JWT in httpOnly cookie (24h expiry, Secure, SameSite=Lax)
```

Pseudo_id derivation matches the bot's `pseudonymize()` function: `hex(SHA256(user_id.to_string())[0:8])` → 16 hex chars.

## Data Model

```sql
-- Identity
users (
  id uuid PRIMARY KEY,
  discord_id_hash text UNIQUE,     -- hashed, never plaintext
  pseudo_id text UNIQUE,           -- SHA256-derived, matches bot output
  global_opt_out bool DEFAULT false,
  opt_out_at timestamptz,
  created_at timestamptz
)

-- Sessions
sessions (
  id uuid PRIMARY KEY,             -- matches bot's session_id (UUID v4)
  guild_id bigint,
  started_at timestamptz,
  ended_at timestamptz,
  game_system text,
  campaign_name text,
  participant_count int,
  s3_prefix text,                  -- e.g. "sessions/{guild_id}/{session_id}"
  status text,                     -- awaiting_consent | recording | uploaded | transcribing | ready | published
  collaborative_editing bool DEFAULT true,
  created_at timestamptz
)

-- Per-speaker per-session participation
session_participants (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES sessions,
  user_id uuid REFERENCES users,
  consent_scope text,              -- full | decline_audio | decline
  consented_at timestamptz,
  withdrawn_at timestamptz,
  mid_session_join bool,
  data_license text DEFAULT 'open' -- open | rail | private
)

-- Transcription output (from streaming pipeline)
transcript_segments (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES sessions,
  segment_index int,
  speaker_pseudo_id text,
  start_time float,
  end_time float,
  text text,                       -- current (may be edited by participants)
  original_text text,              -- immutable Whisper output
  confidence float,
  created_at timestamptz
)

-- Participant flags on segments
segment_flags (
  id uuid PRIMARY KEY,
  segment_id uuid REFERENCES transcript_segments,
  flagged_by uuid REFERENCES users,
  reason text,                     -- 'private_info'
  flagged_at timestamptz,
  reverted_at timestamptz
)

-- Participant corrections (ASR training data)
segment_edits (
  id uuid PRIMARY KEY,
  segment_id uuid REFERENCES transcript_segments,
  edited_by uuid REFERENCES users,
  original_text text,              -- Whisper output at time of edit
  new_text text,                   -- human correction
  edited_at timestamptz
)

-- Audit trail for consent changes
consent_audit_log (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  session_id uuid,                 -- null for global actions
  action text,                     -- grant | withdraw | global_opt_out | global_opt_in | license_change
  previous_scope text,
  new_scope text,
  timestamp timestamptz,
  ip_address inet
)
```

## Three-Tier Data Licensing

Per-speaker per-session, orthogonal to recording consent:

| Tier | `data_license` | Published? | LLM training? | License |
|------|---------------|-----------|---------------|---------|
| Full Open | `open` | Yes (`ovp-open`) | Yes | CC BY-SA 4.0 |
| Research Only | `rail` | Yes (`ovp-rail`) | No | CC BY-SA 4.0 + RAIL addendum |
| Private | `private` | No | No | Internal use only |

Default: `open` (most permissive).

**Bot consent flow:**
1. Accept / Decline (gates recording — all must respond)
2. Ephemeral follow-up after Accept: "No LLM Training" / "No Public Release" buttons (non-blocking, default open if ignored)

**Portal:** Users can change their license tier at any time on the session detail page.

## Security

### Caddy (network edge)
- Rate limiting: 60 req/min per IP on `/api/*`

### Axum (application)
- Auth required on all `/api/v1/*` except `/auth/discord/callback`
- Per-user rate limiting (tower middleware, keyed on JWT user ID):
  - General: 120 req/min
  - Mutations (flag/edit): 30 req/min
  - Export: 1 per hour
  - Auth: 10 req/min per IP
- Input validation: edit text ≤ 2000 chars, flag reason enum-only
- CORS: frontend origin only
- JWT: 24h expiry, httpOnly cookie
- OAuth state parameter for CSRF prevention

### Data level
- Queries always scoped to user's pseudo_id (can only see own sessions)
- Edit permission enforced server-side (own line OR collaborative_editing flag)
- Audio endpoints verify requester is a session participant
- Flagged segment text not returned to non-flaggers

## API Surface

### Auth
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/discord/callback` | Exchange OAuth code → JWT cookie |
| GET | `/api/v1/auth/me` | Current user info |
| POST | `/api/v1/auth/logout` | Clear cookie |
| POST | `/api/v1/auth/me/opt-out` | Global opt-out |
| POST | `/api/v1/auth/me/opt-in` | Undo opt-out |
| POST | `/api/v1/auth/me/export` | Request data export |
| GET | `/api/v1/auth/me/export/:id/status` | Poll export job |
| GET | `/api/v1/auth/me/export/:id/download` | Download export ZIP |
| DELETE | `/api/v1/auth/me` | Delete account (GDPR erasure) |
| GET | `/api/v1/auth/me/audit` | Consent audit log |

### Sessions
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sessions` | List user's sessions |
| GET | `/api/v1/sessions/:id` | Session detail + consent info |
| PATCH | `/api/v1/sessions/:id` | Update session settings (collaborative_editing) |
| POST | `/api/v1/sessions/:id/consent/withdraw` | Withdraw consent (deletes audio) |
| POST | `/api/v1/sessions/:id/consent/reinstate` | Reinstate consent |
| PATCH | `/api/v1/sessions/:id/license` | Change data license tier |

### Transcripts
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sessions/:id/transcript` | All segments with `is_own_line`, `can_edit` |
| GET | `/api/v1/sessions/:id/audio/clip` | Stream audio clip (query: speaker, start, end) |
| GET | `/api/v1/sessions/:id/audio/combined` | Stream combined session audio |

### Segments
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/segments/:id/edit` | Submit transcript correction |
| POST | `/api/v1/segments/:id/flag` | Flag segment as private info |
| DELETE | `/api/v1/segments/:id/flag` | Undo own flag |

## Bot ↔ Database Integration

The bot writes to Postgres at 5 points:

1. **`/record`** — creates session + participant rows
2. **Consent button** — updates participant scope + consented_at, inserts audit log entry
3. **Quorum met** — updates session status to `recording`
4. **`/stop` finalization** — updates session with ended_at, duration, s3_prefix, status `uploaded`
5. **Blocklist check** — reads `users.global_opt_out` before adding participants

DB writes are non-blocking: if Postgres is down, bot logs the error and continues with S3. Sessions can be backfilled from S3 meta.json/consent.json.

## Testing Strategy

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest | Components, hooks, formatters with mocked API |
| Integration | Vitest + React Testing Library | Page renders, consent flows, flag/edit interactions |
| E2E | Playwright | Full OAuth flow (mock Discord server), transcript interaction, responsive layout |

External service mocks:
- **Discord OAuth:** Local mock server mimicking `/oauth2/authorize`, `/oauth2/token`, `/users/@me`
- **Rust API:** MSW (Mock Service Worker) for frontend-only tests; real Axum + test Postgres for E2E
- **S3:** `STORAGE_BACKEND=local` env flag serves test fixtures from disk
