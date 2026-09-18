# `internal/app-err`

`apperr.Error` is the only error shape a service or handler should return
when it wants to control the HTTP response. Everything else becomes a
generic `500` (see `api.Serve` in [api.md](./api.md)).

```go
type Error struct {
    StatusCode int            `json:"statusCode"`
    Err        error          `json:"-"`
    Message    string         `json:"message"`
    Details    map[string]any `json:"details"`
}
```

## Constructors

One constructor per status code actually used in the app, each wrapping a
`fmt.Errorf` for `Error()`/logging plus the `Message` sent to the client:

```go
apperr.NotFound("entity not found")
apperr.BadRequest(err.Error())
apperr.Conflict("...")
apperr.Unauthorized("...")
apperr.Forbidden("...")
apperr.UnprocessableEntity("...")
apperr.InternalServerError("...")
apperr.NetworkError("...")       // 502 — used for upstream connection failures
apperr.New(statusCode, message, details)  // escape hatch for anything else
```

Use the named constructor matching the failure, not `apperr.New` with a
hardcoded status — it documents intent at the call site and keeps status
codes consistent across modules.

## Where these get created

- **Repository layer** (`internal/repository`, see
  [repository.md](./repository.md)): `Repository[T].UpdateByID`/`DeleteByID`
  return `apperr.NotFound(...)` when zero rows were affected —
  `FindByID`/`UpdateByID`/`DeleteByID` calling code doesn't need its own
  "not found" check.
- **Service layer** (`internal/module/<name>/service.go`, see
  [modules.md](./modules.md)): for domain-specific validation the repository
  can't express — e.g. rejecting a payload that fails a business rule with
  `apperr.BadRequest(...)`.
- **Database layer** (`internal/infra/database`): `HandleDBError` maps known
  GORM/Postgres errors (e.g. a unique constraint violation) to an
  `apperr.Error`, so a repository or service doesn't have to special-case
  low-level provider error types itself.

## How it reaches the client

Nothing in a service/handler writes the HTTP response for an error — it
just returns the `*apperr.Error` (or lets a repository/`HandleDBError` one
propagate) and `api.Serve` (see [api.md](./api.md)) unwraps it with
`errors.As` and calls `WriteAppError`, which serializes `Error` as-is (note
`Err` is `json:"-"` — the client only ever sees `statusCode`/`message`/
`details`, never Go-internal error text).
