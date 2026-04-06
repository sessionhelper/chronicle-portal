# ttrpg-collector-frontend

Vite + React SPA for the Open Voice Project participant portal.

See `~/sessionhelper-hub/CLAUDE.md` for org-wide conventions, code style, git workflow, and design system rules.

## Stack

- Vite + React + TypeScript
- Tailwind CSS (Parchment design system)
- react-router-dom for client-side routing
- No SSR, no component library — pure SPA

## Development

```bash
npm run dev     # Vite dev server on :5173
npm run build   # Static build to dist/
```

## Environment

- `VITE_API_URL` — ovp-data-api base URL (default: `http://localhost:3001`)
