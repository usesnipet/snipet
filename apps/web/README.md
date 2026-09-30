# web

The React admin UI. Vite + React 19 + TanStack Query + Zod, styled with
shadcn/Radix + Tailwind v4.

```bash
pnpm install
pnpm dev         # dev server on :5173, proxies /api to BACKEND_URL (see .env.example)
pnpm typecheck   # tsc -b
pnpm lint        # eslint
pnpm build       # tsc -b && vite build -> dist/
```

For production the Go backend embeds `dist/` (`//go:embed`, build tag `web`)
and serves the SPA on the same origin as `/api` — see `web/web.go`.

## Conventions

- Architecture & patterns: [`../docs/web/`](../docs/web/README.md).
- Editor-enforced rules (lazy routes, etc.): [`CLAUDE.md`](./CLAUDE.md).
- Scaffold a new feature: `.claude/skills/create-web-feature`.

Structure: `src/features/<feature>/` (one folder per domain: schemas,
service, hooks, store, components), `src/models/` (entity schemas),
`src/components/` (shared UI + shadcn primitives), `src/lib/` (HTTP client,
dialogs, query client), `src/routes/` + `src/router.tsx` (pages, lazy-loaded).
