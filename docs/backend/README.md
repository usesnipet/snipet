# Backend

Documentation for the conventions used in the Go backend (everything outside
`web/`). Like [`docs/web/`](../web/README.md), this is not a description of
the current state of the code — it's a guide to the *patterns* the project
follows, so anyone adding or changing backend code knows where things belong
and why.

For a step-by-step scaffold, see the
[`create-backend-module` skill](../../.claude/skills/create-backend-module/SKILL.md).
This folder explains the reasoning behind each layer it scaffolds.

## Stack

- **Go**, HTTP via [chi](https://github.com/go-chi/chi) — routing/middleware.
- **GORM** + **PostgreSQL** — persistence. Schema is migration-driven
  (`golang-migrate` + [Atlas](https://atlasgo.io)), never `AutoMigrate`.
- **go-playground/validator** + **mold** — DTO validation and normalization.
- **mockery** — generates repository mocks for service tests.

## Layout

```
cmd/api/main.go          API entrypoint: load config, build logger, call bootstrap.Bootstrap
cmd/scaffold/            one-shot template initializer (deletes itself)
config/                   env-driven configuration structs
internal/
  bootstrap/               wires every layer together, registers routes
  api/                      chi wrapper: Handler contract, error-aware Serve, Parse*/Write*, SSE
  app-err/                  *apperr.Error — the only error shape handlers/services should return
  module/<name>/             one folder per domain: dto.go, service.go, handler.go
  repository/                 generic Repository[T] + one IXxxRepository per entity
  model/                       GORM entities
  filter/                       generic Where/Order/Include query-builder
  page/                          Paginated[T] envelope
  auth/                           JWT + API-key + password primitives (HTTP-agnostic)
  guard/                           chi middleware (Gates) built on auth/ — admin basic auth
  infra/                             database bootstrap, in-memory cache
  queue/                              in-process background worker pool (present, unwired)
migrations/               timestamped .up.sql/.down.sql pairs (Atlas-managed)
pkg/                      framework-agnostic helpers (json_schema, jsonx, collections)
```

The skeleton ships one module, `system` (`GET /api/system/info`). Everything
else is added with the scaffold skill.

## Request lifecycle

```
cmd/api/main.go
  → config.Load()
  → bootstrap.Bootstrap(cfg, logger)
       → build repositories (internal/repository)
       → build services (internal/module/<name>)
       → build guards (internal/guard)
       → build handlers, call handler.RegisterRoutes(r, api.Serve)
       → http.ListenAndServe
```

Per request: `chi` matches a route → the registered middleware chain runs
(auth, logging, recover) → the handler's `HandlerFunc` runs, wrapped by
`api.Serve` (turns a returned `error` into the right HTTP response) → the
handler parses the request (`api.ParseBody`/`api.ParseQuery`) → calls a
`Service` method → the service talks to a `Repository` → the handler writes
the response (`api.WriteJSON`/`api.WriteNoContent`).

## Docs

| Doc | Covers |
|---|---|
| [modules.md](./modules.md) | `internal/module/<name>` — dto/service/handler layering |
| [api.md](./api.md) | `internal/api` — chi wrapper, error-aware handlers, SSE |
| [errors.md](./errors.md) | `internal/app-err` — the app's error type |
| [repository.md](./repository.md) | `internal/repository` — generic `Repository[T]` |
| [filter-page.md](./filter-page.md) | `internal/filter` + `internal/page` — query building and pagination |
| [model.md](./model.md) | `internal/model` — GORM entity conventions |
| [migrations.md](./migrations.md) | `migrations/` — schema change workflow |
| [auth-middleware.md](./auth-middleware.md) | `internal/auth` + `internal/guard` — admin basic auth + JWT primitives |
| [bootstrap.md](./bootstrap.md) | `cmd/api` + `internal/bootstrap` + `config/` — wiring |
| [infra.md](./infra.md) | `internal/infra` + `internal/queue` — database, cache, background jobs |

`pkg/` is documented inline via Go doc comments — run `go doc ./pkg/...`.
