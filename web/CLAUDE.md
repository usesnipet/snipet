# Web app conventions

## Lazy route imports

All route pages and layouts registered in `web/src/router.tsx` must use `React.lazy` + dynamic `import()`. Never statically import route modules.

Guards, shared components (`LoadingFallback`), and `ROUTES` may stay as static imports.

```typescript
// BAD — eager route bundle
import { AdminPage } from "./routes/admin/page";

// GOOD — code-split per route
const AdminPage = lazy(() =>
  import("./routes/admin/page").then((m) => ({ default: m.AdminPage })));
```

- Wrap the `<Routes>` tree in `<Suspense fallback={<LoadingFallback />}>`.
- Map named exports to `default` inside `.then((m) => ({ default: m.X }))`.
- Add new pages/layouts the same way; do not introduce static route imports.

## Adding a new feature

See the `create-web-feature` skill (`.claude/skills/create-web-feature/`) for the conventions used under `web/src/features/`.
