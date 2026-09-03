# `internal/filter` + `internal/page`

The generic query-building layer every `Repository[T].Filter` call goes
through (see [repository.md](./repository.md)): `filter` describes *what*
to query for, `page` shapes the result that comes back.

## `filter.Options[T]` and the builder

```go
type Options[T any] struct {
    Take    int
    Skip    int
    Order   OrderOptions
    Where   WhereOptions
    Include []string
}
```

Built with functional options, not struct literals, so callers compose only
what they need:

```go
filter.New[model.Widget](
    filter.WhereEq("id", id),
    filter.OrderDesc("created_at"),
    filter.Take(50),
    filter.Include("Author"),
)

filter.Default[model.Widget]()  // Take(2000), Skip(0) — the fallback when a repository gets a nil filter
```

Common options: `Take`/`Skip`/`PtrTake`/`PtrSkip` (the `Ptr*` variants are
what a filter DTO's `ToFilter()` uses — see [modules.md](./modules.md)
— since query params are optional), `OrderAsc`/`OrderDesc`, `Where<Op>`
(`WhereEq`, `WhereNeq`, `WhereGt`/`Gte`, `WhereLt`/`Lte`, `WhereLike`,
`WhereIn`/`NotIn`, `WhereBetween`, `WhereIsNull`/`IsNotNull`), and
`Include(paths...)` for GORM preloads.

## Combining filters: `From` / `Merge`

```go
filter.Merge(baseFilter, userSuppliedFilter)  // later filters win on conflicting keys, Where/Order merge, Include unions
```

Use this when a service needs to combine a caller-supplied filter with one
it enforces itself (e.g. scoping a query to a single `app_code`) rather
than hand-merging two `Options[T]` structs.

## Turning it into a GORM query: `ToGorm`

```go
func (f *Options[T]) ToGorm(gormInterface gorm.Interface[T], optionsFuncs ...GormOptionsFunc) (gorm.ChainInterface[T], error)
```

`Repository[T].Filter` calls this twice — once with
`WithAllowOrder/Paginate/Preload(false)` to get an accurate `Count`, once
with defaults to fetch the page — so `Take`/`Skip` never skew the total.
`GormOptionsFunc`s (`WithAllowWhere`, `WithAllowOrder`, `WithAllowPaginate`,
`WithAllowPreload`, all `true` by default via `DefaultGormOptions`) exist
for exactly that count-vs-fetch split; a repository method outside
`Filter`/`FindByID` rarely needs to touch them directly.

## Validation: field/include allowlisting

Before building any query, `Options[T].Validate()` checks every `Where`/
`Order` field name and every `Include` path against `T`'s actual GORM
schema (via reflection, cached per type) — an unknown column or association
is rejected instead of silently producing broken SQL or, worse, letting a
caller-controlled field name through unchecked. This runs automatically
inside `ToGorm`, so a repository doesn't call it separately.

This matters because `Where`/`Order`/`Include` values on a filter frequently
originate from a `FindXsFilterDTO`'s query-string fields (see
[modules.md](./modules.md)) — validation is what keeps that
client-influenced input safe to interpolate into a query.

## `page.Paginated[T]`

```go
type Paginated[T any] struct {
    Data  []T   `json:"data"`
    Total int64 `json:"total"`
    Skip  int64 `json:"skip"`
    Take  int64 `json:"take"`
}
```

What every `Filter` call returns and what a `filter` handler method
(`api.WriteJSON(w, http.StatusOK, data)`, see [api.md](./api.md)) sends to
the client as-is — it's the backend counterpart to the frontend's
`Paginated<T>` (see [`docs/web/schemas.md`](../web/schemas.md)). Helpers:
`IsEmpty`/`IsNotEmpty`, `First`/`Last`, `Count`, `HasNext`/`HasPrevious`.
`Repository[T].FindByID` uses `IsEmpty`/`First` internally: it's built on
top of `Filter` with `WhereEq("id", id)`, not a separate code path.
