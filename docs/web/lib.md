# `src/lib/`

Cross-cutting infrastructure that every feature builds on but that isn't
itself a feature or a UI primitive.

## `http/`

The fetch layer every `service.ts` is built on (see
[features/service.md](./features/service.md)).

- **`http.ts`** — `httpx`, the core request function, plus its
  `httpGet`/`httpPost`/`httpPut`/`httpDelete` wrappers and the `http`
  `HttpClient` instance services actually call. Handles:
  - **path params**: `{id}` placeholders in `url`, resolved from `params`
    (`applyPathParams`) — same placeholder syntax as `ROUTES` (see
    [routes.md](./routes.md)).
  - **search params**: serialized from `searchParams`
    (`buildSearchParams`/`applySearchParams`), skipping `null`/`undefined`.
  - **auth**: an `auth` option — `"api-key"`, `"jwt"`, or `false`
    (default). Reads the token straight out of the owning feature's store
    (e.g. `useAuthStore.getState().accessToken` — see
    [features/store.md](./features/store.md)) and attaches it as a header.
    This is the one place `lib/` is allowed to depend on a specific
    feature. The skeleton ships no such store — wire this when you add
    token auth.
  - **schema validation**: if `schemas.body`/`searchParams`/`headers`/
    `pathParams`/`response` are given, each is `.parse()`d (Zod errors are
    turned into an `ApiError` via `parseZodErrors`); a non-2xx response is
    turned into an `ApiError` via `handleApiError`.
- **`errors.ts`** — `ApiError` (with `statusCode`/`details`), plus the
  parsing helpers `http.ts` uses to turn a failed `Response` or a
  `ZodError` into one. Catch `ApiError` (via `ApiError.is(err)`) wherever
  you need to branch on `statusCode`.
- **`sse.ts`** — `httpSse`, for endpoints that stream
  `text/event-stream` (chat responses). Same shape as `httpx` (auth,
  schemas, path/search params) but calls `onEvent(event, data)` per SSE
  frame instead of resolving once.

## `services.ts`

`ServiceGetOptions`/`ServicePostOptions`/`ServicePutOptions`/
`ServiceDeleteOptions` — the corresponding `Http*Options` type from
`http.ts` with `url` omitted. This is what a feature's `service.ts`
functions accept as their trailing `opts` parameter (see
[features/service.md](./features/service.md)); it exists purely so a
feature doesn't have to redeclare "all the Http options except url" itself.

## `dialog/` {#dialog}

An imperative, stack-based dialog system — open a dialog from anywhere
(an event handler, not just JSX) without each feature managing its own
`open` boolean.

- **`store.ts`** — a Zustand store holding the stack of currently-open
  dialogs (`{ id, component, props, onClose }[]`). `openDialog` pushes an
  entry (deferred one tick so it can be called during another component's
  render/effect) and returns `{ id, close }`; `closeDialog`/
  `closeAllDialogs` pop entries and fire their `onClose`.
- **`provider.tsx`** — `DialogProvider`/`DialogContainer`, mounted once in
  `root-providers.tsx`. Renders every entry in the stack inside a `ui/`
  `<Dialog>`, injecting `{ id, close }` plus that entry's `props` into the
  dialog component.
- **`use-dialog.ts`** — `useDialog()`, the hook components actually call:
  `const { openDialog } = useDialog(); openDialog({ component: CreateFooDialog, props: {} })`.
- **`types.ts`** — `DialogInstanceProps<P>` (`P & { id, close }`), the
  props type every dialog component built for this system takes; `close()`
  is what a feature's create/update/delete dialog calls on success (see
  [features/components.md](./features/components.md)).

## `query-client.ts`

The single `QueryClient` instance (`queryClient`), created once and passed
to `QueryClientProvider` in `root-providers.tsx`. `hooks.ts` files import
it directly to call `queryClient.invalidateQueries(...)` after a mutation.

## `logger.ts`

A leveled console logger (`logger.debug/info/warn/error`) gated by a
`PUBLIC_LOG_LEVEL` env var (defaults to `debug` in dev, `warn` in prod).
Prefer this over calling `console.*` directly so log verbosity stays
controllable per environment.

## `utils.ts`

- `cn(...)` — `clsx` + `tailwind-merge`, the standard way to compose
  conditional Tailwind classes across `ui/` and every other component.
- `truncate(text, maxLength)` — small string helper.
