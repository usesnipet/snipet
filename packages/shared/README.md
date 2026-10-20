# @snipet/shared

The Snipet API contract: Zod schemas and their TypeScript types. Internal: not published.

- `src/api/<resource>.ts`: request, response and query-param schemas per resource.
- `src/schemas`: building blocks (JSON values, data URLs, keys, plugin/LLM manifests).
- `src/utils`: small helpers shared by both sides (roles, date checks).

The API validates input with these schemas and the client validates responses with the same ones,
so a contract change shows up as a type error on both sides.
