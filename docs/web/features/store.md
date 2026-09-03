# `store.ts` (optional)

For state the feature owns that isn't server data — auth tokens, an
API key, anything that needs to be read or written outside of a React
render (e.g. by `lib/http` when attaching an auth header). Built with
[Zustand](https://zustand.docs.pmnd.rs/getting-started/introduction).

```typescript
import { create } from "zustand";

type AuthStore = {
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
  setTokens: (tokens: AuthTokens) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: localStorage.getItem(KEYS.accessToken),
  // ...
  setTokens: (tokens) => {
    const parsed = authTokensSchema.parse(tokens);
    localStorage.setItem(KEYS.accessToken, parsed.access_token);
    // ...
    set({ accessToken: parsed.access_token /* ... */ });
  },
  clear: () => {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
    set({ accessToken: null /* ... */ });
  },
}));
```

(A token store — `features/auth/store.ts` — trimmed. The skeleton has no
store; the only Zustand store today is `lib/dialog/store.ts`.)

## Store vs. TanStack Query

Not every piece of state is a store:

- **Comes from the API and can go stale / be refetched?** → that's server
  state, it belongs in `hooks.ts` behind `useQuery`, not in a store.
- **Client-owned, doesn't come from a request, and/or needs to be read
  outside a component** (a request interceptor, a route guard before any
  component mounts)? → a Zustand store.

A token store is the canonical example: it holds tokens, persists them to
`localStorage` on every write, and validates incoming data with the
feature's own `schemas.ts` (`authTokensSchema.parse(tokens)`) before
storing it.

## Reading a store outside React

Because Zustand stores aren't React Context, they can be read outside a
component with `useXStore.getState()` — this is how `lib/http` attaches
auth headers without needing to be inside the React tree:

```typescript
const accessToken = useAuthStore.getState().accessToken;
```

## Selecting multiple fields without extra re-renders

When a hook/component needs several fields or actions from a store at
once, select them together with `zustand/react/shallow`'s `useShallow` so
the component doesn't re-render on every unrelated field change:

```typescript
export function useDialog() {
  return useDialogStore(
    useShallow((s) => ({
      openDialog: s.openDialog,
      closeDialog: s.closeDialog,
      closeAllDialogs: s.closeAllDialogs,
    })),
  );
}
```

(from `lib/dialog/use-dialog.ts` — see [../lib.md](../lib.md).)

## When not to add one

If the feature has no state beyond what `hooks.ts` already caches via
TanStack Query, skip `store.ts` entirely.
