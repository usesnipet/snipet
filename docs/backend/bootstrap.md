# `cmd/api` + `internal/bootstrap` + `config/`

Where every other layer gets constructed and wired together. Nothing here
holds business logic — it's strictly composition.

## `config/`

One struct per concern (`ServerConfig`, `DatabaseConfig`, `LogConfig`,
`AuthConfig`, `SyncConfig`), composed into one `Config`, loaded from
environment variables (via `go-envconfig`, with `.env` support for local
dev — `config.Load()` walks up from the working directory looking for a
`.env` file):

```go
type Config struct {
    Server   ServerConfig   `env:", prefix=SERVER_"`
    Database DatabaseConfig `env:", prefix=DB_"`
    Log      LogConfig      `env:", prefix=LOG_"`
    Auth     AuthConfig     `env:", prefix=AUTH_"`
    Sync     SyncConfig     `env:", prefix=SYNC_"`
    Env      string         `env:"ENV, default=development"`
    DevProxy string         `env:"DEV_PROXY, default=http://localhost:5173"`
}
```

`AuthConfig` holds admin basic auth (`AUTH_BASIC_AUTH_USERNAME` /
`AUTH_BASIC_AUTH_PASSWORD`) and the JWT settings the `auth` primitives use
when you add token-based auth.

A new cross-cutting setting gets a field (with `env:"..., default=..."`)
on the relevant sub-struct, not a bespoke `os.Getenv` call somewhere deep
in the code. `config.APIPrefix` (`"/api"`) lives here too — the one
constant every module's routes are mounted under.

## `cmd/api/main.go`

The actual binary entrypoint — deliberately tiny:

```go
func main() {
    cfg, err := config.Load()
    level, _ := logger.ParseLevel(cfg.Log.Level)
    appLogger := logger.NewLogger(level)
    bootstrap.Bootstrap(cfg, appLogger)
}
```

Its only job is to load config, build the root logger, and hand off to
`bootstrap.Bootstrap`.

## `internal/bootstrap.Bootstrap` — the wiring order

Everything is built by hand (no DI framework), in dependency order, inside
one function. The skeleton version is short:

1. **Database** — `database.NewDatabase(cfg, logger)` (ensures the DB
   exists, opens the connection, runs migrations — see
   [migrations.md](./migrations.md) and [infra.md](./infra.md)).
2. **Repositories** — `repository.NewTxManager(db)` plus one
   `repository.NewXRepository(db, ...)` per entity (see
   [repository.md](./repository.md)). Some repositories depend on another —
   construct in the order that satisfies those dependencies.
3. **Auth primitives** — `auth.NewAPIKeyGenerator`, `auth.NewKeyHasher`,
   `auth.NewJWTService(cfg.Auth, ...)` when a module needs them (see
   [auth-middleware.md](./auth-middleware.md)).
4. **Services** — one `<module>.NewService(repo, ..., logger)` per module,
   each depending only on repository interfaces and other services it
   genuinely needs (see [modules.md](./modules.md)).
5. **Guards** — `guard.RequireBasicAuth(cfg.Auth...)` (and any others you
   add), passed as raw `api.Gate`s into modules (see
   [auth-middleware.md](./auth-middleware.md)).
6. **Handlers** — one `<module>.NewHandler(service, gate...)` per module.
7. **Routes** — `api.New()`, mount the built SPA (`web.Handler()`) as the
   catch-all, then every `handler.RegisterRoutes(r, api.Serve)` under
   `config.APIPrefix` (see [api.md](./api.md)).
8. **Serve** — `http.ListenAndServe` + graceful shutdown.

Adding a new module means adding one line to steps 2 and 4–7 — see the
`create-backend-module` skill's bootstrap step for the exact checklist.

## Import aliasing

Hyphenated module directories (e.g. `api-key`) can't be imported under
their literal package name, so `bootstrap` (and anything else importing
them) aliases: `apikey "github.com/.../module/api-key"`.
