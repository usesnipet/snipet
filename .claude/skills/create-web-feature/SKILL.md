---
name: create-web-feature
description: Scaffold a new frontend feature folder (schemas, service, hooks, store, components) under web/src/features following this project's conventions. Use when creating or adding a new feature, page, or API-backed module in the web app.
---

# Web Features

Create domain features under `web/src/features/<feature-name>/` (kebab-case). Include only the layers the feature needs.

## Fast path: `hygen module …` (or `hygen web …` for frontend only)

[Hygen](https://www.hygen.io) generators (full details in
`_templates/README.md`). Needs `hygen` globally (`npm i -g hygen`); run from
the repo root.

**`hygen module …` is the primary path** — every `module` generator writes
this feature *and* its Go backend counterpart in one run:

```
hygen module new Order --fields "title:string:required,qty:int,spec:jsonb:required"   # full CRUD both ends
hygen module model Order --fields "..."     # web/src/models/order.ts   + internal/model/order.go
hygen module handler Order                  # web/src/features/order/hooks.ts   + internal/module/order/handler.go
hygen module dto Approve --module order --fields "..."   # append approveOrderSchema to schemas.ts + ApproveOrderDTO to dto.go
```

`module new` emits **full CRUD**; `module model`/`handler` emit a **lean
skeleton** for that layer (`hooks` = `use<X>` only) — grow it by hand.
`module dto` **injects** a named DTO/schema into the module's existing
`dto.go` + `schemas.ts` (module must exist). Backend-only named services:
`hygen module service <Name> --module order`.

Use `hygen web …` only for a **frontend-only** feature (no backend module):

```
hygen web new Order --fields "..."      # model + schemas + service + hooks (full CRUD)
hygen web model / schemas / service / hooks Order   # one file, lean skeleton
```

Field spec is `name:type[:flag...]` — types `string|text|int|int64|float|bool|time|uuid|jsonb`
map to the Zod calls below; non-`required` fields get `.optional()`. Schema
keys stay **snake_case** to match the Go `json:` tags. Run granular pieces
with the same `--fields` so the picks line up with the model.

It does **not** generate `store.ts`, `components/`, or route registration —
those stay manual. The rest of this doc is the reference for what it emits
and the layers it skips.

## Structure

```
web/src/features/<feature>/
  schemas.ts              # required when there are types/API payloads
  service.ts              # HTTP calls
  hooks.ts                # React Query wrappers
  store.ts                # optional client/persisted state (Zustand)
  components/             # optional feature-owned UI
```

## models/

- The entity schema (the one with relations to other entities) lives in `web/src/models/<feature>.ts`, not in the feature folder. This keeps entity-to-entity relations from creating feature-to-feature imports (and eventual import cycles).
- `web/src/models/<feature>.ts` only defines the entity + its value objects (nested config/metadata types). No DTOs, no pagination wrappers.
- A feature that needs another entity's model imports it from `@/models/<other>`, never from `@/features/<other>/schemas`.

```typescript
// web/src/models/foo.ts
import { z } from "zod";

export const fooSchema = z.object({ id: z.string(), name: z.string() }).strict();
export type Foo = z.infer<typeof fooSchema>;
```

## schemas.ts

- Re-export the entity from `@/models/<feature>` so existing call sites keep importing from the feature (`export { fooSchema } from "@/models/foo"; export type { Foo } from "@/models/foo";`).
- Define DTOs (create/update, pagination wrappers, search params, responses) here; export types with `z.infer<typeof schema>`.
- Prefer `.strict()` on objects; use `.pick()` / `.extend()` on the imported entity schema for create/update DTOs.
- Coerce dates with `z.coerce.date()` when the API returns ISO strings.
- Reuse shared schemas (e.g. `paginatedSchema` from `@/schemas/paginated`) — those stay generic utilities in `@/schemas`, distinct from `@/models` entities.
- Skip the `models/` split entirely for singleton/config schemas with no id and no relations (e.g. app-level config) — those can stay entirely in `schemas.ts`.

```typescript
import { fooSchema } from "@/models/foo";

export { fooSchema } from "@/models/foo";
export type { Foo } from "@/models/foo";

export const createFooSchema = fooSchema.pick({ name: true }).strict();
export type CreateFoo = z.infer<typeof createFooSchema>;
```

## service.ts

- Call `@/lib/http` (`http.get` / `post` / `put` / `delete`).
- Accept `ServiceGetOptions` / `ServicePostOptions` / `ServicePutOptions` from `@/lib/services`.
- Pass Zod `schemas` for `body` and/or `response`; use `params` for path placeholders (`{id}`).
- Prefer a named object export (`fooService`) when there are multiple methods; named function exports are fine for small features.

```typescript
const FOO_URL = "/api/foo";

const list = async (opts: ServiceGetOptions<Paginated<Foo>> = {}) =>
  http.get({ url: FOO_URL, schemas: { response: paginatedFooSchema }, ...opts });

export const fooService = { list };
```

## hooks.ts

- Wrap services with `useQuery` / `useMutation` from `@tanstack/react-query`.
- Export query/mutation key factories: `listFooQueryKey`, `useListFoo`, etc.
- On mutations: toast success/error via `@/hooks/use-toast`, then `queryClient.invalidateQueries`.
- Forward service opts; set auth in the hook when required (`auth: "api-key"`).

## store.ts (optional)

- Use Zustand `create`.

## components/ (optional)

- Own only UI tightly coupled to the feature.
- Import hooks/schemas/store from the parent feature folder (`../hooks`, etc.).
- Shared/generic UI stays in `web/src/components`.

## New routes

If this feature adds a routed page, register it in `web/src/router.tsx` — routes there must be lazy-loaded (see project convention in `web/CLAUDE.md`).
