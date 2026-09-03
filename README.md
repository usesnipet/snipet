# orders

A starter template for a layered Go REST API with an embedded React admin UI.
It ships the infrastructure — routing, generic repository, migrations,
config, admin auth, request/response plumbing — plus the `.claude/skills`
that scaffold new modules and features, and one example module (`system`).

> **New project?** See [TEMPLATE.md](./TEMPLATE.md) — run
> `go run ./cmd/scaffold -module github.com/you/proj -name Proj` and it
> rewrites the module path, resets `.env`, regenerates codegen, and removes
> itself.

## Stack

| Layer | Technology |
|-------|------------|
| Language | Go 1.26+ |
| HTTP | [chi](https://github.com/go-chi/chi) |
| ORM | GORM + PostgreSQL |
| Migrations | golang-migrate (apply) + [Atlas](https://atlasgo.io) (generate from models) |
| Validation | go-playground/validator + mold |
| Mocks | mockery |
| Frontend | Vite + React 19 + TanStack Query + Zod (in `web/`, embedded via `//go:embed` for prod builds) |

## What's in the box

```
cmd/api/            API entrypoint
cmd/scaffold/       one-shot template initializer (deletes itself)
config/             env-driven configuration structs
internal/
  bootstrap/        wires every layer together, registers routes
  api/              chi wrapper: Handler contract, error-aware Serve, Parse*/Write*, SSE
  app-err/          *apperr.Error — the error shape services/handlers return
  module/system/    the one shipped module — GET /api/system/info
  repository/        generic Repository[T] + ITxManager
  model/             GORM entities (empty; add with the skill)
  filter/ page/      generic query builder + Paginated[T] envelope
  auth/ guard/       JWT/API-key/password primitives + admin Basic Auth gate
  infra/ queue/      database bootstrap, in-memory cache, worker pool (present, unwired)
migrations/         timestamped .up.sql/.down.sql pairs (Atlas-managed)
pkg/                framework-agnostic helpers (json_schema, jsonx, collections)
docs/backend/       backend pattern & convention guide
docs/web/           frontend pattern & convention guide
web/                the React app
```

## Prerequisites

- Go 1.26+
- Docker + Docker Compose (local PostgreSQL)
- pnpm (for `web/`)
- Atlas CLI — only to *generate* migrations from models (`make db-generate`)

## Quick start

```bash
docker compose up -d postgres          # Postgres on localhost:5432, db "orders"
cp .env.example .env                    # review it
make dev                                # api on :8080 + web dev server (:5173)
```

```bash
curl -u admin:change-me-in-production http://localhost:8080/api/system/info
# {"version":"dev"}
```

Full stack in Docker: `docker compose up -d` (the API image embeds the built
frontend and serves it on the same origin as `/api`).

## Adding to it

| Task | Where |
|---|---|
| Backend module (model → migration → repository → service → handler → tests → wiring) | `.claude/skills/create-backend-module` |
| Web feature (models → schemas → service → hooks → components) | `.claude/skills/create-web-feature` |
| Keep the docs in sync after a structural change | `.claude/skills/update-docs` |
| Architecture reference | [docs/backend/](./docs/backend/README.md), [docs/web/](./docs/web/README.md) |

## Make commands

```bash
make dev          # hot-reload api + web dev server
make test         # go test ./...
make build        # dev build -> ./tmp/api
make build-prod   # prod build with embedded frontend -> ./out/web-prod
make mocks        # regenerate repository mocks (mockery)
make openapi      # regenerate docs/swagger/ (swag)
make db-generate <name>   # generate a migration by diffing GORM models (Atlas)
```

## Environment variables

`config/` loads these from `.env` (searched up from the working directory)
then the environment. See [`.env.example`](./.env.example) for the full set;
the prefixes are `SERVER_`, `DB_`, `LOG_`, `AUTH_`, `SYNC_`.

## Publishing as a GitHub Template Repository

Push this to its own repo, then turn on **Settings → General → Template
repository**. Consumers run `gh repo create you/proj --template you/this-repo`
(or `npx degit you/this-repo proj`) and then the scaffold step above.

## License

MIT — see [LICENSE](./LICENSE).
