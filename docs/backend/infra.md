# `internal/infra` + `internal/queue`

Infrastructure a module depends on but doesn't own: the database
connection/migrations, an in-memory cache, and a background job pool.

## `internal/infra/database`

`database.NewDatabase(cfg, logger)` (called once, in `bootstrap`, see
[bootstrap.md](./bootstrap.md)) does three things in snipet:

1. **`ensureDatabase`** — if `DB_AUTO_CREATE` is set, connects to the
   `postgres` admin database and `CREATE DATABASE`s the target if it
   doesn't exist yet (convenience for local dev; skipped by default).
2. Opens the real `*sql.DB`/`*gorm.DB` (via `pgx` + GORM's postgres
   provider), with `TranslateError: true` so GORM surfaces typed errors
   (`gorm.ErrDuplicatedKey`, etc.) instead of raw provider errors, and
   `SkipDefaultTransaction: true` (services opt into transactions
   explicitly via `repository.ITxManager`, see
   [repository.md](./repository.md), rather than paying for one on every
   single-statement call).
3. **`runMigrations`** — if `DB_AUTO_MIGRATE` is set, runs every pending
   migration in `migrations/` via `golang-migrate` (see
   [migrations.md](./migrations.md)) before the app starts serving
   requests.

**`error-map.go`**'s `HandleDBError` maps known Postgres/GORM errors (e.g. a
unique constraint violation) to an `apperr.Error` (see
[errors.md](./errors.md)) — `api.Serve` calls this as a fallback when a
handler's error isn't already an `*apperr.Error`, so a repository doesn't
need its own per-error-code branching.

## `internal/infra/cache`

```go
type ICache interface {
    Set(key string, value any, opts ...SetOption) error
    Get(key string) (any, bool)
    Delete(key string) error
    Exists(key string) bool
    Clear() error
    Keys() []string
    Len() int
}

func GetAs[T any](c ICache, key string) (T, bool)  // typed Get, avoids a manual type assertion at every call site
```

`MemoryCache` is the one implementation: an LRU-bounded (`maxEntries`),
optionally-TTL'd in-memory map with a background janitor goroutine
sweeping expired entries. It exists for **process-local, short-lived**
caching — today its only consumer is `RequireAPIKey` (see
[auth-middleware.md](./auth-middleware.md)), caching a verified API key's
ID for a minute so every request doesn't re-hash and re-query. It is not a
distributed cache — nothing here is safe to rely on being shared across
multiple app instances.

## `internal/queue`

```go
type Job func(ctx context.Context) error
type IPool interface {
    Submit(ctx context.Context, job Job) error
}
```

A fixed-size, in-process worker pool for background work that shouldn't
block an HTTP response — a service submits a closure instead of running the
work inline:

```go
func (s *Service) Reindex(ctx context.Context, id string) error {
    return s.pool.Submit(ctx, func(ctx context.Context) error {
        return s.worker.Run(ctx, id)
    })
}
```

The skeleton does not wire the pool (`bootstrap` no longer builds it), but
the package is here for when you need it:
`queue.NewPool(cfg.Sync.Workers, logger).Start(ctx)` is built once in
`bootstrap` (see [bootstrap.md](./bootstrap.md)); a service depends on the
`queue.IPool` interface so it's mockable in tests. A job's error is logged
by the pool's worker loop, not surfaced to whoever called `Submit` — by the
time a job runs, the HTTP request that enqueued it has usually already
returned `202`-equivalent to the client, so job failures have to be
observed some other way (logs, or a status field on the owning row that a
later poll can read).

This is intentionally simple — no retries, no persistence, no
distributed queue. A job that needs to survive a process restart or run
across multiple instances needs different infrastructure than this pool.
