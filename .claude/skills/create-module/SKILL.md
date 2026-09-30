---
name: create-module
description: Scaffold a new NestJS CRUD module (entity, dto, service, controller, module) on top of the generic abstractions in apps/api/src/common, with shared zod schemas in packages/shared. Use when creating or adding a new module, entity, resource, or CRUD API.
---

# Create a module

Monorepo (pnpm + turbo). Schemas shared with the frontend live in
`packages/shared/src/api` (zod only, no TypeORM); the API adds the TypeORM bits.
Helpers used by both sides (e.g. `hasRole`) live in `packages/shared/src/utils`.

```
packages/shared/src/api/<name>.ts   # zod: response, create, update, find params
                                   # + export it from src/api/index.ts
apps/api/src/modules/<name>/
  <name>.entity.ts      # extends BaseEntity, implements the contract type
  <name>.dto.ts         # re-exports create/update, find params -> where/order
  <name>.service.ts     # extends CrudService<Entity>, injects the TypeORM repo
  <name>.controller.ts  # extends CrudController<Entity>(schemas)
  <name>.module.ts      # TypeOrmModule.forFeature([Entity]) + controller + service
```

Then add the module to `imports` in `apps/api/src/app.module.ts` and
generate a migration for the new table.

## Migrations (TypeORM CLI)

Files go to `apps/api/src/migrations`. Scripts build first; the CLI reads
`dist/infra/database/cli-data-source.js`, which also creates the DB if missing.

- `pnpm migration:generate <Name>`: diff entities vs the DB into a new migration.
- `pnpm migration:create <Name>`: empty migration for hand-written SQL.
- `pnpm migration:run` / `pnpm migration:revert` / `pnpm migration:show`.
- On boot the API runs pending migrations (`DB_AUTO_MIGRATE`, default `true`).

Review generated SQL: a rename comes out as drop + add, and a new `NOT NULL`
column on a populated table needs a default or backfill.

## What you get for free

| Route | Service method | Status |
|---|---|---|
| `GET /<name>?take&skip&<filters>` | `filter(query)` returns `Paginated<T>` | 200 |
| `GET /<name>/:id` | `findById(id)` | 200 / 404 |
| `POST /<name>` | `create(dto)` | 201 |
| `PUT /<name>/:id` | `updateById(id, dto)` partial | 204 / 404 |
| `DELETE /<name>/:id` | `deleteById(id)` | 204 / 404 |

- Every route needs `Authorization: Bearer <access token>` (global `AuthGuard`,
  401 without it). Mark a route/controller `@Public()` to open it, or
  `@Roles(Role.Admin)` to restrict it (403). `@CurrentUser()` gives `{ id, role }`.
  All in `common/decorators/auth.decorators.ts`.
- Body/query are validated by `ZodPipe`, invalid input is a 400 with zod issues.
- Unique violations become 409 (`common/filter/db-error.filter.ts`, extend `PG_ERRORS` for more).

## DTO rules

### Update = `create.partial()`, no `.default()` on create fields

In `packages/shared/src/api/widget.ts`:

```ts
export const createWidgetSchema = z.object({
  name: z.string().min(1).max(255),
  spec: z.record(z.string(), z.unknown()).optional(),
});
export const updateWidgetSchema = createWidgetSchema.partial();
```

`PUT {"name":"new"}` only updates `name`; keys missing from the body are left
out of the `UPDATE`.

Don't write `spec: z.record(...).default({})`: `.partial()` keeps the default,
so `PUT {"name":"new"}` would parse to `{"name":"new","spec":{}}` and wipe the
saved `spec`. Keep the field `.optional()` in zod and put the default on the
column instead:

```ts
@Column({ type: "jsonb", default: {} })
spec: Record<string, unknown>;
```

If a zod default is really needed, write the update schema by hand instead of
using `.partial()`.

### Find = shared params in `@snipet/shared`, `.transform()` in the API

The query params the client sends are shared. `paginationParamsSchema` already
handles `take` and `skip`; add the module's own params with `.extend()`:

```ts
// packages/shared/src/api/widget.ts
export const findWidgetsParamsSchema = paginationParamsSchema.extend({
  name: z.string().optional(), // accepts ?name=...
});
```

The API turns them into TypeORM `where`/`order` in `<name>.dto.ts`. TypeORM
never goes into `@snipet/shared`. The ordering is fixed here (like `ToFilter()` in the
Go project), not chosen by the client:

```ts
// apps/api/src/modules/widget/widget.dto.ts
export { createWidgetSchema, updateWidgetSchema } from "@snipet/shared";

export const findWidgetsSchema = findWidgetsParamsSchema.transform(({ name, ...page }) => ({
  ...page, // take, skip
  where: name ? { name: ILike(`%${name}%`) } : undefined,
  order: { createdAt: "DESC" as const },
}));
```

`GET /widget?name=alp&take=5` reaches the service as
`{ take: 5, skip: 0, where: { name: ILike("%alp%") }, order: { createdAt: "DESC" } }`, and
`CrudService.filter` passes it straight to `repo.findAndCount`. All
query-string filtering lives in the DTO; the service doesn't know which
filters exist. Other TypeORM operators work the same way:

```ts
where: {
  status: In(["active", "draft"]), // ?status=active,draft
  createdAt: MoreThan(new Date(from)), // ?from=2026-01-01
}
```

### Response schema

`widgetSchema` (dates as `z.coerce.date()`) is the response shape. The entity
declares `class Widget extends BaseEntity implements WidgetContract`, so tsc
fails if the entity and the contract drift apart.

After changing `packages/shared`, rebuild it (`pnpm build`, or `pnpm dev` keeps it in
watch mode); the API imports its `dist`.

## Beyond CRUD

- Extra logic: override a method in the service or add new ones; `this.repo` is
  the TypeORM repository.
- Extra routes: add methods to the controller with normal Nest decorators.
- Extra services for specific concerns: `<name>.<concern>.service.ts`, register
  it in the module `providers`.
- Transactions: inject `DataSource` and use `dataSource.transaction(...)`.
- Cache: use Nest's `@nestjs/cache-manager` (not installed yet).
- Dynamic JSON validated against a stored JSON Schema:
  `validateJson(schema, data)` from `apps/api/src/utils/json-schema/json-schema.ts` (fills defaults,
  throws 400); `checkJsonSchema(schema)` to validate the schema itself.
