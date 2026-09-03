# `module` generators (full-stack)

Every `module` generator writes the **backend** file and its **frontend**
sibling in one run. Follows
[`create-backend-module`](../../.claude/skills/create-backend-module/SKILL.md),
[`create-web-feature`](../../.claude/skills/create-web-feature/SKILL.md), and
`docs/`. See [../README.md](../README.md) for setup, the `h.*` helpers, and
the field-spec grammar.

## Commands

```
hygen module new Order --fields "title:string:required,qty:int,spec:jsonb:required"   # full CRUD
hygen module model Order --fields "..."          # internal/model/order.go + web/src/models/order.ts
hygen module handler Order                       # handler.go + hooks.ts   (skeletons)
hygen module repository Order                    # internal/repository/order.go   (backend only)
hygen module dto Approve --module order --fields "reason:string:required,notify:bool"
hygen module service Pricing --module order      # internal/module/order/pricing.go
hygen module method Void --module order --kind command
```

- **`module new`** = full CRUD across all nine files (5 Go + 4 TS).
- **`module model`** — the entity struct + `TableName()` (Go) and the Zod
  schema (TS). Full shape either way; nothing to trim.
- **`module handler`** — `Handler` + `RegisterRoutes` with a single
  `GET /{id}` (Go) and a `use<X>` hook (TS). A skeleton to grow.
- **`module repository`** — `IXxxRepository` + impl (already minimal).
- **`module dto <Name> --module <x>`** — appends a **named DTO** to an
  existing `internal/module/<x>/dto.go` (`Approve` + `order` →
  `ApproveOrderDTO`, `time`/`jsonx` imports added if the fields need them)
  **and** a matching `<name>OrderSchema` + type to
  `web/src/features/<x>/schemas.ts`. Idempotent (`skip_if`). The module must
  already exist (`module new` first).
- **`module service <Name> --module <x>`** — a **named** service file
  `internal/module/<x>/<name>.go` holding `<Name>Service` (struct + ctor +
  `FindByID`). A module can hold several — one per cohesive set of
  operations. Backend only; `unless_exists` so a re-run never clobbers.
- **`module method <M> --module <x>`** — injects `func (s *Service) <M>(...)`
  at the end of `service.go`. `--kind query` → `(*model.X, error)`,
  `command` → `error`. Idempotent.

`--module` is asked if omitted. Run related pieces with the **same
`--fields`** so DTO/schema picks line up with the model.

## What `module new` generates

```
# backend
internal/model/<kebab>.go            # ID + <fields> + CreatedAt/UpdatedAt + TableName()
internal/repository/<kebab>.go       # IXxxRepository + impl embedding Repository[T]
internal/module/<kebab>/dto.go       # CreateXDTO, UpdateXDTO, FindXsFilterDTO + ToFilter()
internal/module/<kebab>/service.go   # Filter/FindByID/Create/Update/DeleteByID
internal/module/<kebab>/handler.go   # chi routes + CRUD handlers + swagger annotations
# frontend
web/src/models/<kebab>.ts            # entity Zod schema + type
web/src/features/<kebab>/schemas.ts  # create/update DTOs + paginated + list params
web/src/features/<kebab>/service.ts  # <feature>Service: list/findById/create/update/delete
web/src/features/<kebab>/hooks.ts    # useList<Plural>, use<Feature>, useCreate/Update/Delete + query keys + toasts
```

`.go` files are `gofmt`-ed by a `sh:` hook.

## After generating (manual)

1. `make mocks` — `mocks.MockIXxxRepository`.
2. `make db-generate create_<table>_table` — Atlas diffs the model into a
   migration (`docs/backend/migrations.md`).
3. Wire in `internal/bootstrap/bootstrap.go`: repo → service → handler →
   `RegisterRoutes`.
4. Frontend: `cd web && pnpm typecheck && pnpm lint`; register a route in
   `web/src/router.tsx` if the feature has a page.

## Templates

Plain files, no symlinks — each generator owns its `.ejs.t`. `module/new/`
holds the full-CRUD backend templates plus `web-*.ejs.t` (full-CRUD frontend,
duplicated from `web/new/` — keep in sync). The granular dirs hold their own
lean templates. Backend templates iterate `goFields`, frontend `zodFields` —
both from the one prompt (`namedPrompt`).
