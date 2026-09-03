---
name: create-backend-module
description: Scaffold a new Go domain module (model, migration, repository, DTOs, service, handler, tests) following this project's layered architecture. Use when creating or adding a new backend module, entity, resource, or CRUD API under internal/.
---

# Backend Modules

Create domain modules as layers under `internal/`. Application/domain logic never goes in `pkg/` (framework-agnostic helpers only).

## Fast path: `hygen module …`

[Hygen](https://www.hygen.io) generators (`_templates/module/`, full details
in `_templates/README.md`). Needs `hygen` globally (`npm i -g hygen`); run
from the repo root. **Every `module` generator is full-stack** — it writes
the backend file *and* its frontend sibling (`web/src/models/…`,
`web/src/features/…`) in one run.

```
hygen module new Order --fields "title:string:required,qty:int,spec:jsonb:required"   # full CRUD, 5 Go + 4 TS
hygen module model Order --fields "..."       # internal/model/order.go  + web/src/models/order.ts
hygen module handler Order                     # handler.go + hooks.ts    (skeleton: one GET /{id} route)
hygen module repository Order                  # internal/repository/order.go   (backend only)
hygen module dto Approve --module order --fields "..."   # append ApproveOrderDTO to dto.go + approveOrderSchema to schemas.ts
hygen module service Pricing --module order    # internal/module/order/pricing.go — a named PricingService (several per module)
hygen module method Void --module order --kind command   # append a stub to service.go
```

`module new` emits full CRUD. `module model`/`handler` emit a lean skeleton
for that layer. `module dto`/`method` **inject** into files `module new`
created (module must exist). `module service` adds a **named** service file
— a module can hold several, one per cohesive set of operations. `--module`
is asked if omitted; run related pieces with the same `--fields`.

Field spec is `name:type[:flag...]` — types `string|text|int|int64|float|bool|time|uuid|jsonb`,
flags `required|unique|index|nullable`. Backend side of `module new`:
`internal/model/<kebab>.go` (ID + fields + `CreatedAt`/`UpdatedAt` +
`TableName()`), `internal/repository/<kebab>.go`, and
`internal/module/<kebab>/{dto,service,handler}.go`, each `gofmt`-ed.

It does **not** touch the migration, mocks, or bootstrap — those are still
manual (steps 2, 4, 6 below). The rest of this doc is the reference for what
the generators emit and for what they don't cover (custom repository queries,
route auth, relationships).

## Checklist

1. `internal/model/<entity>.go` — GORM entity
2. `migrations/<timestamp>_….up.sql` + `.down.sql` — schema (no AutoMigrate)
3. `internal/repository/<entity>.go` — `IXxxRepository` + impl
4. Regenerate mocks (`make mocks`)
5. `internal/module/<name>/{dto,service,handler}.go` + `service_test.go`
6. Wire in `internal/bootstrap/bootstrap.go`: repo → service → handler → `RegisterRoutes`

## Naming

| Kind | Convention | Example |
|------|------------|---------|
| Module dir | kebab-case | `api-key` |
| Go package | concatenated | `apikey` |
| Model/repo file | kebab-case preferred | `api-key.go` |
| Repo interface | `I` + Entity + `Repository` | `IWidgetRepository` |
| DTOs | `CreateXDTO`, `UpdateXDTO`, `FindXsFilterDTO` | |

Reference: `internal/module/system` is the only shipped module (a trivial
GET, no repository). The snippets below are self-contained — follow them
plus `docs/backend/` for the full CRUD shape.

## Model

```go
type Foo struct {
    ID   string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
    Name string `gorm:"type:varchar(255);not null" json:"name"`
}
```

- UUID PKs; sensitive fields `json:"-"`; JSONB via `jsonx.JSONMap` or `serializer:json`.
- Add `TableName()` when GORM pluralization is wrong.

## Repository

```go
type IFooRepository interface {
    IRepository[model.Foo]
    // custom methods only when generic CRUD is not enough
}

type FooRepository struct {
    *Repository[model.Foo]
}

func NewFooRepository(db *gorm.DB) IFooRepository {
    return &FooRepository{Repository: NewRepository[model.Foo](db)}
}
```

- Interface + impl in the same file; ctor returns the interface.
- Prefer embedding `IRepository[T]`; override Filter/Find or add scoped methods only when generic CRUD isn't enough (a parent-scoped query, a relationship-aware write).
- Mocks: mockery via `//go:generate` → `internal/repository/mocks/`.

## Module files

```
internal/module/<name>/
  dto.go
  service.go
  handler.go
  service_test.go
```

### DTO

- Create: value fields + `validate` tags.
- Update: **pointers** for partial patches (`omitempty`).
- List: `form` tags + `ToFilter() *filter.Options[model.X]`.

### Service

- Depend on **repository interfaces** (and other `*Service` when needed).
- `NewService(...) *Service`.
- Domain errors via `apperr` (`NotFound`, `BadRequest`, …).
- Typical methods: `Filter`, `FindByID`, `Create`, `Update`, `DeleteByID`.

### Handler

- `NewHandler(...) api.Handler` with `RegisterRoutes(r chi.Router, serve api.ServeFunc)`.
- Parse with `api.ParseBody` / `api.ParseQuery`; params via `chi.URLParam`.
- Status: list/get `200`, create `201`, update/delete `204` (`api.WriteNoContent`).
- Auth: inject middleware (`apiKeyMiddleware` / any-auth) and `r.Use(...)` inside the route group.

## Service tests

- External package: `package foomodule_test`.
- `t.Parallel()`; testify + `mocks.NewMockIFooRepository(t)`.
- Helper `newTestService(repo)` wiring real collaborators when cheap (hasher, logger).
- Assert `*apperr.Error` with status/message when testing domain failures.

```go
repo := mocks.NewMockIFooRepository(t)
repo.EXPECT().Create(mock.Anything, mock.Anything).Return(nil)
svc := newTestService(repo)
```

## Bootstrap

In `bootstrap.Bootstrap`: construct repo → service (optional `Init`) → handler → call `RegisterRoutes` under `/api`. Alias hyphenated imports (`apikey "…/api-key"`).
