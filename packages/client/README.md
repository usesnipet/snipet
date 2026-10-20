# @snipet/client

Typed client for the Snipet API. Internal: not published.

Per resource (`src/<resource>/`):

- `service.ts`: plain functions over the HTTP client, validating requests and responses with the
  [`@snipet/shared`](../shared) schemas.
- `hooks.ts`: TanStack Query hooks over the service (`useListSessions`, `useStartRun`...).

```ts
import { configureHttp, useListAgents } from "@snipet/client";

configureHttp({
  baseUrl: "https://snipet.example.com",
  getAccessToken: () => token,
  refreshToken: async () => false, // renew the token after a 401; true retries the request
});
```

`src/http` holds the HTTP client: JSON requests, typed `ApiError`s, a single token refresh on 401,
and SSE streams (agent run events).

Shipped as TypeScript source (`exports` points at `src/index.ts`): consumers compile it with their
own bundler, so there's no build step. Peer dependencies: `react`, `@tanstack/react-query`, `zod`.
