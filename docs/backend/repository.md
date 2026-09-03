# `internal/repository`

Generic CRUD (`Repository[T]`) shared by every entity, plus one
`IXxxRepository` + concrete type per entity for the custom queries generic
CRUD can't express.

## The generic interfaces

```go
type IFilterableRepository[T any] interface {
    Filter(ctx context.Context, filter *filter.Options[T]) (*page.Paginated[T], error)
}
type IFindableRepository[T any] interface {
    FindByID(ctx context.Context, id string) (*T, error)
}
type ICreatableRepository[T any] interface {
    Create(ctx context.Context, model *T) error
}
type IUpdatableRepository[T any] interface {
    UpdateByID(ctx context.Context, id string, model *T) error
}
type IDeletableRepository[T any] interface {
    DeleteByID(ctx context.Context, id string) error
}

type IRepository[T any] interface {
    IFilterableRepository[T]
    IFindableRepository[T]
    ICreatableRepository[T]
    IUpdatableRepository[T]
    IDeletableRepository[T]
}
```

`Repository[T]` (in `repository.go`) implements all five against a
`*gorm.DB`, using [`internal/filter`](./filter-page.md) to build the query
and [`internal/page`](./filter-page.md) to shape the result:

```go
func (r *Repository[T]) Filter(ctx context.Context, filterOptions *filter.Options[T]) (*page.Paginated[T], error) {
    // count with pagination/order/preload disabled, then fetch with them enabled
}
func (r *Repository[T]) FindByID(ctx context.Context, id string) (*T, error) {
    // Filter with WhereEq("id", id), apperr.NotFound if empty
}
func (r *Repository[T]) UpdateByID(ctx context.Context, id string, model *T) error {
    // gorm.G[T](db).Where("id = ?", id).Updates(ctx, *model); apperr.NotFound if 0 rows affected
}
```

`UpdateByID` uses GORM's `Updates` with a struct value, which only sets
columns that are non-zero on `model` — this is what makes the
pointer-fields DTO pattern in `service.go` work (see
[modules.md](./modules.md)): a field the caller didn't set stays
at Go's zero value and is left out of the `SET` clause entirely.

## Per-entity repository

```go
type IWidgetRepository interface {
    IRepository[model.Widget]
}

type WidgetRepository struct {
    *Repository[model.Widget]
}

func NewWidgetRepository(db *gorm.DB) IWidgetRepository {
    return &WidgetRepository{Repository: NewRepository[model.Widget](db)}
}
```

- Interface + implementation live in the same file (`repository/<entity>.go`).
- The constructor returns the **interface**, not the concrete type — this
  is what a module's `service.go` depends on (see
  [modules.md](./modules.md)), so it can be swapped for a mock in tests.
- Embed `*Repository[model.Widget]` to get the five generic methods for
  free. Only override a method, or add a scoped one, when generic CRUD
  genuinely isn't enough (a relationship-aware write, a query scoped to a
  parent row).

## Transactions

```go
type ITxManager interface {
    WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
```

`repository.NewTxManager(db)` is what a service depends on (as
`repository.ITxManager`) for multi-step writes that must be atomic — e.g.
creating a parent row and replacing its child associations inside one
`WithTransaction` call. Every repository method
called with the `ctx` `WithTransaction` hands back runs against the same
transaction — repositories don't need to know they're inside one; `db(ctx)`
resolves the right `*gorm.DB` from context internally.

## Mocks

Repository interfaces are mocked with [mockery](https://vektra.github.io/mockery/)
(config in `.mockery.yml`, marker in `repository/generate.go`), regenerated
with `make mocks` into `internal/repository/mocks/`. Service tests depend on
these mocks, never a real database — see `service_test.go` conventions in
[modules.md](./modules.md).
