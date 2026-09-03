# `src/components/`

Shared UI: design-system primitives, and any component reused by two or
more features (or by `routes/` chrome). If a component only serves one
feature, it belongs in that feature's own `components/` instead — see
[features/components.md](./features/components.md).

## Subfolders

### `ui/`

shadcn/radix primitive wrappers — `button.tsx`, `dialog.tsx`, `input.tsx`,
`table.tsx`, `sidebar.tsx`, `form.tsx`, etc. These are the design-system
layer: everything else in the app (feature components, `components/form`,
`components/catalog`, ...) is built out of these, never out of raw HTML
elements or a UI library directly. Keep edits close to the upstream
shadcn API so future `shadcn` CLI updates stay easy to apply.

### `form/`

Field wrappers that bind a `ui/` primitive to `react-hook-form`, e.g.
`FormInput`. Each reads the ambient form via `useFormContext()` and wires
it into `FormField`/`FormControl`/`FormMessage` from `ui/form.tsx`. Use
these instead of wiring `ui/input.tsx` etc. to `react-hook-form` by hand
inside a feature's dialog — they already handle label/description/error
display and the `form.formState.isSubmitting` disabled state.

### `catalog/`

The "list of records behind a create button" page pattern used by most
admin list pages: `CatalogPageContent` renders the create button (or custom
`actions`) into `PageActions` (see `page.tsx` below) and its `children`;
`CatalogCard`/`CatalogList` render the records; small helpers
(`format-updated-at.ts`, `truncate-description.ts`) format record fields
consistently. Reach for this before building a bespoke list page — a
feature's `<Feature>Table` component is typically the only feature-specific
piece needed on top of it.

### `schema-form/`

`SchemaFormDialog` — a dialog that renders a form from a **raw JSON
Schema** at runtime (via `@rjsf/*`), for cases where the form shape isn't
known at compile time — e.g. a `configuration_schema` fetched from
the backend at runtime (see
[schemas.md](./schemas.md)). `buildPasswordUiSchema` auto-masks fields
whose name/format looks like a secret. Use this instead of `components/form`
when the fields to render are only known at runtime; use `components/form`
+ a fixed `schemas.ts` shape when they're known at compile time.

### `sidebar/`

Composition and nav data for the app's sidebars, built on `ui/sidebar.tsx`.
`admin.tsx` and `chat.tsx` are the two concrete sidebars (one per
`routes/` layout); `content.tsx` renders a nav item list; `types.ts`
defines the nav item shape (`NavItem`, `NavItemWithChildren`); `utils.ts`
holds shared helpers (e.g. active-path matching). A new top-level app area
with its own layout typically needs its own file here, following the same
shape as `admin.tsx`.

## Top-level files

- **`page.tsx`** — `Page`, `PageActions`, `PageLeftActions`: the standard
  page chrome every route page renders into (title, description,
  `document.title`, a header actions slot, and a `Suspense` +
  `ErrorBoundary` around the body). `PageActions`/`PageLeftActions` let a
  child component (e.g. `CatalogPageContent`) inject header actions from
  deeper in the tree without prop-drilling.
- **`animated-outlet.tsx`**, **`loading-fallback.tsx`**,
  **`error-fallback.tsx`** — layout-level plumbing used by every
  `routes/*/layout.tsx` and the top-level `Suspense` in `router.tsx`.
- Standalone widgets not tied to one feature (`data-table.tsx`,
  `duration-select.tsx`, `json-viewer.tsx`, `version.tsx`) — generic
  building blocks a feature composes rather than depends on.

## Rule of thumb

New UI goes in `src/components/` when it's either a design-system
primitive (`ui/`) or genuinely shared by 2+ features. Otherwise it starts
in the feature that needs it (`features/<feature>/components/`) and only
moves out here if a second feature ends up needing it too.
