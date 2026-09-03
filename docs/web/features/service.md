# `service.ts`

The only place in a feature that makes an HTTP call. A thin wrapper over
`@/lib/http`'s `http.get`/`post`/`put`/`delete` (see
[../lib.md](../lib.md)) — no business logic, no React, no caching. If
`hooks.ts` or a component needs data from the API, it goes through here.

```typescript
const FOO_URL = "/api/foo";

const list = async (
  opts?: ServiceGetOptions<PaginatedFoo, ListFooSearchParams>,
): Promise<PaginatedFoo> => {
  return http.get({
    url: FOO_URL,
    schemas: {
      response: paginatedFooSchema,
      searchParams: listFooSearchParamsSchema,
    },
    ...opts,
  });
};

const update = async (
  id: string,
  body: UpdateFoo,
  opts?: ServicePutOptions<UpdateFoo, void>,
): Promise<void> => {
  return http.put({
    url: `${FOO_URL}/{id}`,
    params: { id },
    body,
    schemas: { body: updateFooSchema },
    ...opts,
  });
};

export const fooService = { list, create, update, delete: remove };
```

## Conventions

- **One `<FEATURE>_URL` constant** per resource root; path params use the
  same `{param}` placeholder syntax as `ROUTES`
  (`lib/http`'s `applyPathParams` resolves it), passed via `params`.
- **Accept `Service*Options`** from `@/lib/services`
  (`ServiceGetOptions`, `ServicePostOptions`, `ServicePutOptions`,
  `ServiceDeleteOptions`) as the last parameter. These are the equivalent
  `Http*Options` type from `lib/http` with `url` omitted — they let a
  caller (usually `hooks.ts`) forward extra options (`auth`, `searchParams`,
  more `headers`, an `AbortSignal`, ...) without the service function
  needing to know about each one individually. Always spread them last
  (`...opts`) so a caller can't accidentally override `url`/`schemas`.
- **Always pass `schemas`** for `body` and/or `response` so payloads are
  validated at the boundary, not assumed — see [schemas.md](./schemas.md).
- **Export a single named object**, `<feature>Service`, when there's more
  than one method. `delete` is a reserved word, so the local function is
  named `remove` and re-exported as `delete: remove`. For a feature with
  only one or two calls, plain named function exports are fine instead of
  an object.
- A service function's return type mirrors the endpoint: `Promise<void>`
  for a `204`, `Promise<Foo>` for a create, etc. — `hooks.ts` and callers
  rely on this instead of re-checking response shape.

## What doesn't belong here

No `useQuery`/`useMutation`, no toasts, no cache invalidation — that's
`hooks.ts`'s job (see [hooks.md](./hooks.md)). A service function should be
callable and testable with nothing but a mocked `fetch`.
