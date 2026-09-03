# `web` generators (frontend only)

Frontend-only scaffolding, following
[`create-web-feature`](../../.claude/skills/create-web-feature/SKILL.md) and
`docs/web/`. See [../README.md](../README.md) for setup, the shared `h.*`
helpers, and the field-spec grammar.

**Prefer [`module`](../module/README.md)** — every `module` generator already
writes the frontend sibling too (`hygen module new Order` = this *and* the
backend). Reach for `web` only when there is no backend module to generate
(a page consuming an endpoint that isn't a generated module).

## Commands

```
hygen web new Order --fields "title:string:required,qty:int,spec:jsonb"   # model + schemas + service + hooks (full CRUD)
hygen web model Order --fields "..."     # web/src/models/order.ts
hygen web schemas Order --fields "..."   # web/src/features/order/schemas.ts   (Create/Update only)
hygen web service Order                  # web/src/features/order/service.ts   (findById skeleton)
hygen web hooks Order                    # web/src/features/order/hooks.ts     (use<X> skeleton)
```

- **`web new`** = full CRUD (list/findById/create/update/delete + all hooks +
  paginated / list-params schemas).
- **granular** = one file, **lean skeleton**: `schemas` is Create/Update
  only, `service` is just `findById`, `hooks` is just `use<X>`. Grow by hand.
- Granular `schemas`/`service`/`hooks` assume the entity model (and, for
  service/hooks, `schemas.ts`) exists — generate them together with the same
  `--fields`.

Field types map to Zod (v4): `string`→`z.string()`, `int`/`int64`→`z.number().int()`,
`float`→`z.number()`, `bool`→`z.boolean()`, `time`→`z.coerce.date()`,
`uuid`→`z.uuid()`, `jsonb`→`z.record(z.string(), z.unknown())`. Non-`required`
fields get `.optional()`. Schema keys stay **snake_case** to match the Go
`json:` tags on the wire.

## What `web new` generates

```
web/src/models/<kebab>.ts             # entity Zod schema (id, <fields>, created_at, updated_at) + type
web/src/features/<kebab>/schemas.ts   # re-export entity + create/update DTOs + paginated + list params
web/src/features/<kebab>/service.ts   # <feature>Service: list, findById, create, update, delete
web/src/features/<kebab>/hooks.ts     # useList<Plural>, use<Feature>, useCreate/Update/Delete + query keys + toasts
```

Not generated: `store.ts`, `components/`, route registration in
`web/src/router.tsx`.

## After generating

```
cd web && pnpm typecheck && pnpm lint
```

## Templates

Plain files, no symlinks. `web/new/*.ejs.t` are the full-CRUD templates (also
duplicated as `module/new/web-*.ejs.t` — keep in sync). The granular dirs
carry their own lean templates and a one-line `prompt.js`
(`require('../../_lib/prompts').namedPrompt({...})`).
