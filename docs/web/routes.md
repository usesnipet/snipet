# Routes

`src/routes.ts`, `src/router.tsx` and `src/routes/` together define every
page in the app. Each has a distinct job:

- **`routes.ts`** — the single source of truth for URL *strings*.
- **`router.tsx`** — wires those URLs to page components.
- **`routes/`** — the page and layout components themselves.

The skeleton ships one route (`home: "/"`); the patterns below are how you
grow it.

## `routes.ts`

A flat `ROUTES` const, one entry per page, grouped by area with a comment
when there are several. Dynamic segments use `{paramName}`, not
react-router's `:paramName`:

```typescript
export const ROUTES = {
  home: "/",
  widgetDetail: "/widgets/{id}",
} as const;
```

Anything that builds a URL — links, redirects, `service.ts` HTTP calls,
`router.tsx` — reads from `ROUTES`, never hardcodes a path string. This
keeps every path renameable from one place, and lets `service.ts` reuse the
same `{param}` placeholder syntax as `lib/http`'s `applyPathParams` (see
[lib.md](./lib.md)).

## `router.tsx`

Registers the `<Routes>` tree and translates `{param}` → `:param` for
react-router via `toReactRouterPath`. Structure:

- Every route **page and layout component must be lazy-loaded**:
  ```typescript
  const WidgetsPage = lazy(() =>
    import("./routes/widgets/page").then((m) => ({ default: m.WidgetsPage })));
  ```
  This is enforced project-wide — see [`web/CLAUDE.md`](../../web/CLAUDE.md)
  for the exact rule. Shared chrome (`LoadingFallback`, `ROUTES`) stays as a
  regular static import.
- The whole tree is wrapped once in `<Suspense fallback={<LoadingFallback />}>`.
- **Layouts** wrap a group of pages with shared chrome (sidebar, etc.) and
  render `<AnimatedOutlet />` where the matched page goes. The skeleton has
  one, `Layout` (`routes/layout.tsx`), rendering `AdminSidebar` + outlet.
- **Full-screen pages** that bring their own chrome (e.g. a chat with its
  own session sidebar) are registered *outside* `<Layout>`, still inside the
  guards, and render their own `SidebarProvider` + `SidebarInset`:
  ```tsx
  <Route element={<RequireAuth />}>
    <Route element={<RequireRole role="admin" />}>
      <Route path={`${toReactRouterPath(ROUTES.agentPlaygroundSession)}?`} element={<AgentPlaygroundPage />} />
    </Route>
    <Route element={<Layout />}>…</Route>
  </Route>
  ```
- **Optional segments** (`:param?`, built by appending `?` to the
  translated path): use one route instead of two when the page must keep its
  state while the param appears, e.g. navigating from `/agents/playground`
  to `/agents/playground/{sessionId}` after the first message. Two separate
  `<Route>`s would remount the page and drop in-flight state.
- **Route guards** (when you add auth) wrap the routes they protect: a
  guard is a component that renders `<Outlet />` when access is allowed or
  `<Navigate />` otherwise, and belongs to the feature that owns the auth
  concern, not to `routes/`.

## `routes/` folder

The folder tree under `src/routes/` mirrors the URL tree. Each URL segment
is a folder; each folder has at most one `page.tsx` (the routed screen) and
optionally a `layout.tsx` (wraps its own children with shared chrome via
`<Outlet />`/`<AnimatedOutlet />`).

```
routes/
  layout.tsx           # Layout — sidebar + outlet for every page
  page.tsx             # HomePage — "/"
  widgets/
    page.tsx           # WidgetsPage — "/widgets"
    detail/
      page.tsx         # "/widgets/{id}"
```

Two folder-naming conventions to know:

- **`{paramName}/`** — a dynamic segment, matching the `{paramName}`
  placeholder used for the same route in `ROUTES`.
- **`(groupName)/`** — a route group. Parentheses mean the segment is
  *not* part of the URL; it exists only to nest several pages under one
  shared `layout.tsx` without adding a path segment.

Exports from `page.tsx`/`layout.tsx` are **named**, not default (`export
function WidgetsPage()`), because `router.tsx`'s lazy loader maps the
named export to `default` itself.

## What a page does

A page component is thin: it composes feature hooks/components and the
shared page chrome from `src/components/page.tsx` (`<Page>`,
`<PageActions>`) for a consistent title/description/document-title header:

```tsx
export function WidgetsPage() {
  const { openDialog } = useDialog();
  return (
    <Page title="Widgets" description="..." documentTitle="Widgets">
      <PageActions>
        <Button onClick={() => openDialog({ component: CreateWidgetDialog, props: {} })}>
          Create widget
        </Button>
      </PageActions>
      <WidgetTable />
    </Page>
  );
}
```

All actual data-fetching, mutations and domain UI live in the owning
feature (`src/features/<feature>/`) — see
[features/README.md](./features/README.md). Pages don't call `service.ts`
or hold query/mutation state directly.

## Adding a new route

1. Add the URL to `ROUTES` in `routes.ts`.
2. Create `routes/<path>/page.tsx` (and `layout.tsx` if it needs shared
   chrome not already provided by a parent layout).
3. Register it in `router.tsx` as a lazy import, inside the right
   layout nesting.
