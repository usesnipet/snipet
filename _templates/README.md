# Code generators (Hygen)

[Hygen](https://www.hygen.io) generators for this repo.

- **`module …`** — full-stack. Every `module` generator writes the backend
  file **and** its frontend sibling in one run.
- **`web …`** — frontend only. The escape hatch for a page that talks to an
  endpoint with no generated backend module.

Two flavours:

- **`new`** — the complete thing: full CRUD across every layer.
- **granular** (`model`, `dto`, `service`, `handler`, …) — one layer, as a
  **lean skeleton** (a struct, a constructor, one starter method), not the
  full CRUD. Grow it by hand or with `module method`.

## Requirements

`hygen` installed globally (`npm i -g hygen`). **Always run from the repo
root** — helpers read `./go.mod`, and `.hygen.js` (repo root) points Hygen at
`_templates/` and registers the shared helpers.

## Shared helpers — `.hygen.js` + `_templates/_lib/`

`.hygen.js` exposes everything in `_templates/_lib/casing.js` as `h.*` inside
templates, plus type-map helpers:

| helper | example |
|--------|---------|
| `h.pascal(s)` / `h.camel(s)` / `h.kebab(s)` / `h.snake(s)` / `h.constant(s)` | `h.pascal("shipping-address")` → `ShippingAddress` |
| `h.plural(word)` | `h.plural("category")` → `categories` |
| `h.pluralPascal(s)` / `h.tableName(s)` / `h.pluralKebab(s)` | `h.tableName("box")` → `boxes` |
| `h.goModule()` | reads `./go.mod` → `github.com/usesnipet/go-template` |
| `h.goType(t)` / `h.pgType(t)` / `h.zodExpr(t)` | `h.zodExpr("time")` → `z.coerce.date()` |

`_templates/_lib/`:

- `casing.js` — the naming helpers above (no deps; also required by prompt.js).
- `fields.js` — the field-spec grammar, the Go/Zod type catalogs, and
  `goField` / `zodField` / `parseSpec`.
- `prompts.js` — `askName`, `promptFieldSpecs`, `resolveSpecs`, and
  `namedPrompt({ message, fields })` — every simple generator's `prompt.js`
  re-exports this. It returns **both** `goFields` and `zodFields` from one
  answer set, which is what lets a `module` action feed Go and Zod templates
  together. `fields: false` skips the field questions (skeletons that don't
  interpolate fields — `service`, `handler`, `repository`).

## Field spec

`name:type[:flag[:flag...]]`, comma-separated. `--fields ""` means no fields.

- types: `string` `text` `int` `int64` `float` `bool` `time` `uuid` `jsonb`
- flags: `required` (validate + `not null` / non-`.optional()`), `unique`,
  `index`, `nullable` — `unique`/`index`/`nullable` are backend-only.

```
--fields "title:string:required,qty:int:index,sku:string:required:unique,spec:jsonb:required"
```

## Generators

| command | backend | frontend |
|---------|---------|----------|
| `hygen module new <Name>` | model + repository + dto + service + handler (full CRUD) | model + schemas + service + hooks (full CRUD) |
| `hygen module model <Name>` | `internal/model/<x>.go` | `web/src/models/<x>.ts` |
| `hygen module handler <Name>` | `handler.go` skeleton (one `GET /{id}` route) | `hooks.ts` skeleton (`use<X>`) |
| `hygen module repository <Name>` | `internal/repository/<x>.go` | — |
| `hygen module dto <Name> --module <x>` | **appends** `type <Name><X>DTO struct` to `internal/module/<x>/dto.go` (+ any `time`/`jsonx` import) | **appends** `<name><X>Schema` + type to `web/src/features/<x>/schemas.ts` |
| `hygen module service <Name> --module <x>` | `internal/module/<x>/<name>.go` — a **named** `<Name>Service` (a module can hold several) | — |
| `hygen module method <M> --module <x> [--kind command\|query]` | appends a stub to `internal/module/<x>/service.go` (idempotent) | — |
| `hygen web new <Name>` | — | model + schemas + service + hooks (full CRUD) |
| `hygen web model / schemas / service / hooks <Name>` | — | one file, lean skeleton |

`module new` / `web new` are the full-CRUD scaffolds. `model` / `handler` /
`web *` emit a lean skeleton for one layer (grow by hand). `dto` / `method`
**inject** into files an earlier `new` created — the target module must exist.
`dto` / `service` / `method` take `--module <x>` (asked if omitted) plus the
new item's name; `dto` also takes `--fields`. Run related pieces with the
**same `--fields`**. `--dry` previews. Details:
[module/README.md](./module/README.md), [web/README.md](./web/README.md).

## Templates are plain files

No symlinks. Each generator owns its `.ejs.t` outright, so the granular
skeletons can (and do) diverge from the full `new` shape. The full frontend
templates live twice — `web/new/*.ejs.t` and `module/new/web-*.ejs.t` — keep
them in sync when you change one. Backend templates iterate `goFields`,
frontend templates iterate `zodFields`.

## Manual follow-ups (never generated)

- Backend: `make mocks`, `make db-generate create_<table>_table`, and the
  repo→service→handler→`RegisterRoutes` wiring in
  `internal/bootstrap/bootstrap.go`.
- Frontend: `cd web && pnpm typecheck && pnpm lint`; route registration in
  `web/src/router.tsx`; `store.ts` / `components/`.

## Adding a new generator

1. `hygen generator with-prompt --name <thing>` scaffolds `_templates/<thing>/new/`.
2. Replace its `prompt.js` with `require('../../_lib/prompts').namedPrompt({ ... })`.
3. Add `.ejs.t` templates using `h.*` and `goFields` / `zodFields`.
4. Reuse / extend `_templates/_lib/` rather than re-deriving casing or field logic.
