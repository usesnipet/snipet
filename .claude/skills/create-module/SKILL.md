---
name: create-module
description: Scaffold a new NestJS CRUD module (entity, dto, service, controller, module) on top of the generic abstractions in src/common (crud, pagination, pipes, filter). Use when creating or adding a new module, entity, resource, or CRUD API.
---

# Create a module
Every module is:

```
src/modules/<name>/
  <name>.entity.ts      # extends BaseEntity (uuid id, createdAt, updatedAt)
  <name>.dto.ts         # zod schemas: create, update, find (filter)
  <name>.service.ts     # extends CrudService<Entity>, injects the TypeORM repo
  <name>.controller.ts  # extends CrudController<Entity>(schemas)
  <name>.module.ts      # TypeOrmModule.forFeature([Entity]) + controller + service
```

Then add the module to `imports` in `src/app.module.ts`.

## What you get for free

| Route | Service method | Status |
|---|---|---|
| `GET /<name>?take&skip&<filters>` | `filter(query)` returns `Paginated<T>` | 200 |
| `GET /<name>/:id` | `findById(id)` | 200 / 404 |
| `POST /<name>` | `create(dto)` | 201 |
| `PUT /<name>/:id` | `updateById(id, dto)` partial | 204 / 404 |
| `DELETE /<name>/:id` | `deleteById(id)` | 204 / 404 |

- Body/query are validated by `ZodPipe`, invalid input is a 400 with zod issues.
- Unique violations become 409 (`common/filter/db-error.filter.ts`, extend `PG_ERRORS` for more).

## DTO rules

### Update = `create.partial()`, no `.default()` on create fields

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

### Find = `filterSchema.extend(...).transform(...)` returning `where` and `order`

`filterSchema` already handles `take` and `skip`. Add the module's own query
params with `.extend()` and turn them into a TypeORM `FindOptionsWhere` with
`.transform()`. The ordering is fixed by the DTO (like `ToFilter()` in the Go
project), not chosen by the client:

```ts
export const findWidgetsSchema = filterSchema
  .extend({ name: z.string().optional() }) // accepts ?name=...
  .transform(({ name, ...page }) => ({
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

## Beyond CRUD

- Extra logic: override a method in the service or add new ones; `this.repo` is
  the TypeORM repository.
- Extra routes: add methods to the controller with normal Nest decorators.
- Extra services for specific concerns: `<name>.<concern>.service.ts`, register
  it in the module `providers`.
- Transactions: inject `DataSource` and use `dataSource.transaction(...)`.
- Cache: use Nest's `@nestjs/cache-manager` (not installed yet).
- Dynamic JSON validated against a stored JSON Schema:
  `validateJson(schema, data)` from `src/utils/json-schema/json-schema.ts` (fills defaults,
  throws 400); `checkJsonSchema(schema)` to validate the schema itself.
