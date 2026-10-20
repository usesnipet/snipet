# @snipet/server-common

Building blocks for NestJS API. Internal: not published.

- `crud`: `BaseEntity`, a generic `CrudService` and `CrudController` that modules extend.
- `pipes`: `ZodPipe`, validating requests with the [`@snipet/shared`](../shared) schemas.
- `pagination`: `FilterQuery`, the shared pagination params plus a module's filters.
- `filter`: `DbErrorFilter`, Postgres errors (unique, foreign key...) as HTTP errors.
- `database`: `ensureDatabase`, creates the database on boot when it doesn't exist.
- `utils`: `seal`/`open` and `maskSecrets` (encrypted stored credentials), JSON Schema helpers,
  `mapBy`, `sleep`.