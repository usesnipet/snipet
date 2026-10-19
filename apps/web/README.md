# @snipet/web

The Snipet admin UI: agents, playground, connections, knowledge, apps and API keys.
Vite + React 19 + TanStack Query + Zod, styled with shadcn/Radix + Tailwind v4.

```bash
cp .env.example .env   # BACKEND_URL: the API the dev proxy forwards to (default http://localhost:8852)
pnpm dev               # dev server on :5173, proxies /api to BACKEND_URL
pnpm typecheck         # tsc -b
pnpm build             # tsc -b && vite build -> dist/
```

Lint runs from the repo root (`pnpm lint`).

In production the [API](../api) serves `dist/` on the same origin as `/api` (`WEB_DIR`); the Docker
image ships both.

## Layout

- `src/features/<feature>/`: one folder per domain (components, plus schemas, hooks or a store when needed).
- `src/routes/` + `src/router.tsx`: pages, lazy-loaded.
- `src/components/`: shared UI and the shadcn primitives.
- `src/lib/`: HTTP setup, query client, dialogs and other app-wide helpers.

API calls and their React Query hooks come from [`@snipet/client`](../../packages/client).
Editor-enforced rules are in [`CLAUDE.md`](./CLAUDE.md).
