# TTRPG Collector — Frontend

Participant portal for the Open Voice Project. Users whose voice was recorded in TTRPG sessions can manage consent, review transcripts, flag private info, and correct ASR output. Talks to a Rust backend API (Axum).

## Documentation

| Document | What |
|----------|------|
| `docs/architecture.md` | System architecture — services, data model, API surface, security, auth flow |

## Tech Stack

- **Next.js 15** + **React 19** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS 4** (PostCSS integration)
- **Shadcn/ui** (Radix primitives) — cherry-picked components only: Dialog, Button, Badge, Input, RadioGroup, Toast, Tooltip, DropdownMenu
- No external state management — React built-in state (useState, useContext)
- **react-markdown** for rendering markdown content

## Backend Integration

- Backend is **Rust** (not Python/FastAPI like Session Helper)
- Frontend uses `/api/v1` path prefix
- Next.js rewrites proxy `/api/*` to backend at `BACKEND_URL` (default: `http://localhost:8000`)
- Direct backend access via `NEXT_PUBLIC_BACKEND_URL` for file uploads (bypasses Next.js body size limit)
- Centralized API client in `src/lib/api-client.ts`
- Standard REST: GET reads, POST creates, PATCH updates, DELETE removes

## Design System

### Parchment Design System

Matches the Session Helper family (sessionhelper.com, Open Voice Project page). Warm, editorial, minimal.

**Palette:**

| Role | Color |
|------|-------|
| Background | `#f5f0e8` (parchment) |
| Background dark | `#e8e0d0` |
| Card/surface | `#faf6ef` |
| Text (ink) | `#2c2416` |
| Text (light) | `#5a4d3a` |
| Text (faint) | `#8a7d6a` |
| Accent | `#8b4513` (saddle brown) |
| Accent (light) | `#a0522d` |
| Dividers/rules | `#d4c9b5` |

**Background treatment:** Layered radial gradients for subtle warmth/depth — not flat.

**Typography:**
- **Crimson Pro** (serif) — headings, body text, section labels (italic for labels)
- **Inter** (sans) — nav, metadata, footer, table text, small UI elements
- H1: 2.4rem, weight 300, italic
- Section labels: 1.15rem, weight 500, italic, accent color
- H2: Inter, 0.88rem, weight 500
- Body: 1.05rem serif, line-height 1.3
- Small UI text: 0.7-0.85rem sans

**Components:**
- Buttons: solid accent fill (`#8b4513`), 4px radius, Inter font. Ghost variant: transparent + border
- Cards/features: `var(--card)` background, 1px border, 4px radius, subtle top-border accent on hover
- Tables: Inter font, clean borders, uppercase letter-spaced headers
- Links: border-bottom (not text-decoration), hover shifts to accent color
- Bands: alternating sections with light background tint + top/bottom borders
- Flow steps: numbered vertical list in card backgrounds
- Grid cells: 3-col grid for data points, small uppercase labels

**Layout:**
- Content max-width: 660-720px centered
- Nav: fixed top, blurred parchment background, logo left + links right
- Sections: 2.5rem vertical padding
- Responsive: single column below 640px

### UI Rules (Uncodixify)

Build UI that looks like Linear, Raycast, Stripe, or GitHub — not like AI-generated dashboards.

**Do:**
- Sidebar: 240px fixed, solid background, simple border-right
- Headers: simple text, proper h1/h2 hierarchy
- Buttons: solid fills or simple borders, 8-10px radius max
- Cards: 8-12px radius, subtle borders, shadows under 8px blur
- Forms: standard inputs, clear labels above fields, simple focus states
- Spacing: consistent 4/8/12/16/24/32px scale
- Borders: 1px solid, subtle colors
- Transitions: 100-200ms ease, opacity/color only
- Containers: max-width 1200-1400px centered
- Typography: 14-16px body, clear hierarchy

**Do NOT:**
- Oversized rounded corners (20-32px range)
- Floating glassmorphism panels
- Gradient backgrounds on buttons/cards
- Hero sections inside dashboards
- Decorative copy / eyebrow labels / uppercase letter-spaced labels
- Transform animations on hover
- Dramatic shadows (over 8px blur)
- Pill-shaped everything
- Blue-tinted "premium dark mode"
- Metric-card grids as default layout
- `<small>` headers, decorative `<span>` badges

## Project Structure

```
src/
  app/                    # Next.js App Router (file-based routing)
    page.tsx              # Landing page
    layout.tsx            # Root layout
    globals.css           # Tailwind imports + global styles
    [domain]/             # Feature routes
  components/
    layout/               # Sidebar, nav, shared layout
    ui/                   # Reusable UI primitives
  hooks/                  # Custom React hooks
  lib/
    api-client.ts         # Centralized API client
    types.ts              # TypeScript interfaces
```

## Conventions

- `"use client"` directive at top of interactive components
- Functional components with hooks only
- API client methods: `api.domain.action()` pattern
- Dynamic routes: `[paramName]` directories
- No form libraries — controlled inputs with React state
- File uploads: FormData + direct backend URL

## Environment Variables

- `BACKEND_URL` — Backend API URL for Next.js rewrites (default: `http://localhost:8000`)
- `NEXT_PUBLIC_BACKEND_URL` — Backend URL exposed to client for direct uploads

## Development

```bash
npm install
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
```
