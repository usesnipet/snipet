# `src/schemas/`

Zod schemas shared by two or more features — not a general dumping ground
for every schema in the app. A schema that only one feature uses belongs
in that feature's own `schemas.ts` instead (see
[features/schemas.md](./features/schemas.md)); it only moves here once a
second feature needs it too.

## What's here today, as examples of the pattern

- **`paginated.ts`** — the generic list envelope every paginated endpoint
  returns, plus the query params to request a page:
  ```typescript
  export const paginationParamsSchema = z.object({
    take: z.number().min(1).optional(),
    skip: z.number().min(0).optional(),
  }).strict();

  export const paginatedSchema = <T extends z.ZodType>(dataSchema: T) =>
    z.object({ data: z.array(dataSchema), total: z.number(), skip: z.number(), take: z.number() });
  ```
  Any feature with a list endpoint calls `paginatedSchema(fooSchema)`
  rather than redefining the envelope — see `paginatedFooSchema` in
  [features/schemas.md](./features/schemas.md).

`paginated.ts` is the only shared schema the skeleton ships. Add another
here only once a second feature needs the same shape.

## Adding a schema here

Ask: does more than one feature need this exact shape? If yes, it goes
here as a plain exported `z.object(...)` (or a factory, like
`paginatedSchema`, when the shape is generic over another schema) with its
inferred type exported alongside it — same conventions as a feature's own
`schemas.ts` (`.strict()`, derive DTOs instead of redefining them).
