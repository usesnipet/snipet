# Features

`src/features/<feature-name>/` (kebab-case) is where a business domain
lives. A feature folder is the *only* place that should know how to talk to
the API for its domain and hold that domain's client state.

There's a working scaffold skill at
[`.claude/skills/create-web-feature/SKILL.md`](../../../.claude/skills/create-web-feature/SKILL.md)
that generates a new feature; this doc (and its siblings) explain the
reasoning behind each layer in more depth.

## Anatomy

```
web/src/features/<feature>/
  schemas.ts       # Zod schemas + inferred types — required whenever the
                    # feature has API payloads or shared types
  service.ts        # HTTP calls, thin wrapper over @/lib/http
  hooks.ts           # React Query wrappers around service.ts
  store.ts            # optional — client/persisted state (Zustand)
  components/          # optional — UI owned by this feature
```

Include only the layers the feature actually needs. A feature that only
reads data might have just `schemas.ts` + `service.ts` + `hooks.ts`; one
with no API at all (e.g. a purely client-side concern) might be just a
`store.ts`.

Details for each layer:

- [schemas.md](./schemas.md)
- [service.md](./service.md)
- [hooks.md](./hooks.md)
- [store.md](./store.md)
- [components.md](./components.md)

## Data flow

```
components/  →  hooks.ts  →  service.ts  →  schemas.ts
                    │
                    └── @tanstack/react-query (server state, cached)

store.ts  ← read/written directly by anything that needs it
             (components, other features' lib code, route guards)
```

- `schemas.ts` has no dependencies on the other feature layers — it's the
  shape contract everything else builds on. It may depend on
  `@/models/<feature>` (its own entity, if it has one) and
  `@/models/<other>` (another feature's entity, for a relation) — see
  [models.md](../models.md). It never depends on another feature's
  `schemas.ts`.
- `service.ts` depends only on `schemas.ts` and `@/lib/http`.
- `hooks.ts` depends on `service.ts` and wires it into TanStack Query.
- `components/` is the only layer allowed to depend on React Query's hook
  results directly; it should not import `service.ts` and call it by hand.
- `store.ts` is independent of the request/response layers — it's plain
  client state, not server state, so it doesn't go through React Query.

## Cross-feature access

Importing another feature's `service`/`hooks`/`store` directly is normal
and expected — e.g. `lib/http` reads a token feature's `store` to attach
auth headers, and a page composes components from several features. What's
discouraged is reaching into
another feature's `components/` for something that isn't meant to be
reused — that's a sign the component belongs in `src/components/` instead
(see [components.md](../components.md)).

`schemas.ts` is the one exception: never import another feature's
`schemas.ts` from your own. If you need another feature's entity for a
relation, import it from `@/models/<other>` instead — see
[models.md](../models.md) for why.

## Naming

- Feature folder: kebab-case (`api-key`, `knowledge`).
- Exports: camelCase for values/functions (`fooService`, `useListFoo`),
  PascalCase for types and components (`Foo`, `CreateFooDialog`).
- Query/mutation key factories and hooks are named after their service
  method: `list` → `listFooQueryKey` / `useListFoo`, `create` →
  `createFooQueryKey` / `useCreateFoo`.
