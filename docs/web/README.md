# Web app

Documentation for the conventions used in `web/` (the frontend app). This is
not a description of the current state of the code — it's a guide to the
*patterns* the project follows, so anyone adding or changing code here knows
where things belong and why.

For editor-enforced rules (things a linter/reviewer should catch), see
[`web/CLAUDE.md`](../../web/CLAUDE.md). This folder explains the *why* and
the bigger picture behind those rules.

## Stack

- **Vite** + **React 19** — build tool and UI library.
- **react-router 8** — client-side routing (see [routes.md](./routes.md)).
- **TanStack Query** — server state (data fetched from the API).
- **Zustand** — client state (auth tokens, dialogs, anything not owned by
  the server).
- **Zod** — schema validation, both for API payloads and as the source of
  TypeScript types.
- **react-hook-form** — form state, paired with the `components/form`
  wrappers.
- **RJSF** (`@rjsf/*`) — renders forms from a JSON Schema at runtime, used
  where the shape of a form is only known at runtime (e.g. a schema fetched
  from the backend).
- **shadcn/radix + Tailwind v4** — design system primitives (`components/ui`).

## Entry point

```
main.tsx
  └─ RootProviders   (root-providers.tsx)
       └─ Router     (router.tsx)
```

`root-providers.tsx` mounts every app-wide provider once: TanStack Query's
`QueryClientProvider`, `TooltipProvider`, `ThemeProvider`, `DialogProvider`,
and the toast `Toaster`. Anything that needs to exist exactly once for the
whole app goes here.

`router.tsx` owns the `<Routes>` tree. See [routes.md](./routes.md).

The `@/` import alias points at `web/src/`.

## Folder map

| Folder | Purpose | Docs |
|---|---|---|
| `src/routes/` | One file per URL, mirrors the route tree | [routes.md](./routes.md) |
| `src/features/` | One folder per business domain (schemas, service, hooks, store, components) | [features/README.md](./features/README.md) |
| `src/models/` | Zod entity schemas with relations to other entities, one file per feature | [models.md](./models.md) |
| `src/components/` | Shared UI used by more than one feature, plus design-system primitives | [components.md](./components.md) |
| `src/context/` | App-wide React Context providers | [context.md](./context.md) |
| `src/schemas/` | Zod schemas shared by more than one feature | [schemas.md](./schemas.md) |
| `src/lib/` | Cross-cutting infrastructure (HTTP client, dialogs, query client, logger) | [lib.md](./lib.md) |
| `src/hooks/` | Small generic React hooks not tied to any feature (e.g. `use-toast`, `use-mobile`) | — |

## Where does new code go?

- Talks to the API, has its own domain →
  `src/features/<feature>/`.
- That domain's core entity schema (has an `id`, relates to other
  entities) → `src/models/<feature>.ts` (see [models.md](./models.md)),
  re-exported from the feature's `schemas.ts`.
- Pure UI reused by 2+ features, or a design-system primitive → `src/components/`.
- A Zod schema reused by 2+ features (generic shape, not an entity) → `src/schemas/`.
- A new page → a folder under `src/routes/` + an entry in `src/router.tsx`
  (see [routes.md](./routes.md)).
- Everything else (one feature's own UI, one feature's own state) stays
  inside that feature's folder.
