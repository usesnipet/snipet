# `hooks.ts`

Wraps `service.ts` with TanStack Query's `useQuery`/`useMutation`. This is
the layer that owns caching, loading/error state, and the auth mode for
each call — components only ever import from here, never from `service.ts`
directly.

```typescript
const BASE_QUERY_KEY = "foo";

export const listFooQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListFoo = (
  opts?: ServiceGetOptions<PaginatedFoo, ListFooSearchParams>,
): UseQueryResult<PaginatedFoo, Error> => {
  return useQuery({
    queryKey: [...listFooQueryKey(), opts?.searchParams],
    queryFn: () => fooService.list(opts),
  });
};

export const createFooQueryKey = () => [BASE_QUERY_KEY, "create"] as const;
export const useCreateFoo = (
  opts?: ServicePostOptions<CreateFoo, Foo>,
): UseMutationResult<Foo, Error, CreateFoo> => {
  return useMutation({
    mutationKey: createFooQueryKey(),
    mutationFn: (data: CreateFoo) => fooService.create(data, opts),
    onSuccess: () => {
      toast({ title: "Foo created successfully", description: "..." });
      queryClient.invalidateQueries({ queryKey: listFooQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to create Foo", description: "...", variant: "destructive" });
    },
  });
};
```

## Conventions

- **Export a query-key factory next to every hook**: `listFooQueryKey()`,
  `createFooQueryKey()`, etc. Anything that needs to target this query's
  cache entry (another hook's `invalidateQueries`, a manual prefetch)
  imports the factory instead of hand-writing the key array. All keys for
  a feature start with the same `BASE_QUERY_KEY`.
- **One hook per service method**, named `use<Verb><Feature>`
  (`useListFoo`, `useCreateFoo`, `useUpdateFoo`, `useDeleteFoo`).
- **Auth mode is set here, not in `service.ts`**: `{ ...opts, auth:
  "api-key" }` (or `"jwt"`). This keeps `service.ts` agnostic of *who* is
  calling it — a service function can be reused by hooks with different
  auth requirements.
- **Mutations toast and invalidate**: on `onSuccess`, show a success toast
  (`@/hooks/use-toast`) and `queryClient.invalidateQueries` for whichever
  query keys the mutation affects (usually the feature's `list` key). On
  `onError`, show a `variant: "destructive"` toast. Queries (`useQuery`)
  don't toast — let the caller render `isLoading`/`error` from the result.
- **Forward, don't swallow, caller options**: every hook takes an optional
  `opts` of the matching `Service*Options` type and spreads it into the
  `service` call, so a caller can still override `searchParams`,
  `headers`, etc.

## What doesn't belong here

No JSX. Hooks return query/mutation results for a component to consume —
they don't render anything themselves.
