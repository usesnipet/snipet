# `src/context/`

Plain React Context providers for app-wide state that's read almost
everywhere, changes rarely, and doesn't need Zustand's ability to be read
outside a component. Today this is just the theme.

The context object + its hook live in a **`.ts`** file, and the provider
**component** in a sibling **`.tsx`** file — `react-refresh/only-export-components`
forbids a component file from also exporting non-components:

```ts
// theme-context.ts
export const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
```

```tsx
// theme-provider.tsx
import { ThemeContext, type Theme } from "./theme-context";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>(/* read localStorage / prefers-color-scheme */);
  // sync <html> class + localStorage on change
  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}
```

## Conventions

- Pair every context with a `use<Name>()` hook that throws if called
  outside its provider — callers import that hook, never the raw `Context`
  object, and never call `useContext` directly.
- Mount the provider exactly once, in `root-providers.tsx` (see
  [README.md](./README.md#entry-point)) — providers here are app-wide by
  design, not something a feature or route mounts itself.

## Context vs. Zustand store

This app defaults to a Zustand `store.ts` for shared state (see
[features/store.md](./features/store.md)), and only reaches for
`src/context/` when **both** are true:

- the state is genuinely app-wide config, not one feature's data, and
- it only ever needs to be read from inside the React tree (unlike auth
  tokens or the dialog stack, which `lib/http`/`lib/dialog` need to read
  or mutate from outside React — see [lib.md](./lib.md)).

If either condition doesn't hold — the state belongs to one feature, or
something outside React needs to read/write it — use a Zustand store
instead of adding a new file here.
