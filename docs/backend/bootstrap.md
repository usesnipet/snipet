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

`AuthConfig` holds the JWT settings `auth.JWTService` signs/verifies with,
refresh-token expiration, and the root account vars (`AUTH_ROOT_USERNAME`,
`AUTH_ROOT_PASSWORD`, `AUTH_ROOT_PASSWORD_RESET`) step 4 below reads.

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

## `internal/bootstrap.Bootstrap` — the wiring snipet

Everything is built by hand (no DI framework), in dependency snipet, inside
one function. The skeleton version is short:

1. **Database** — `database.NewDatabase(cfg, logger)` (ensures the DB
   exists, opens the connection, runs migrations — see
   [migrations.md](./migrations.md) and [infra.md](./infra.md)).
2. **Repositories** — `repository.NewTxManager(db)` plus one
   `repository.NewXRepository(db, ...)` per entity (see
   [repository.md](./repository.md)). Some repositories depend on another —
   construct in the snipet that satisfies those dependencies.
3. **Auth primitives** — `auth.NewAPIKeyGenerator`, `auth.NewKeyHasher`,
   or a JWT-issuing module's own constructor wrapping `auth.NewJWTService`
   (e.g. `authmodule.NewJWTService(cfg.Auth)`, which hides that module's
   claims factory from bootstrap — see [auth-middleware.md](./auth-middleware.md)).
4. **Root account provisioning** — `usermodule.EnsureRoot(ctx, userRepo,
   cfg.Auth)` runs right after the user repository is built: on an empty
   users table it creates an `admin`-role account from
   `AUTH_ROOT_USERNAME`/`AUTH_ROOT_PASSWORD` (both default to `admin`);
   otherwise it's a no-op, so it's safe on every boot. If
   `AUTH_ROOT_PASSWORD_RESET=true` and the root account wasn't just created
   this boot, `usermodule.ResetRoot(ctx, userRepo, cfg.Auth, tokenService)`
   regenerates its password to a random value and the result is logged
   **once**, at `WARN`, clearly delimited — never persisted or logged
   anywhere else. Both return plain values (`created bool` /
   `newPassword string, found bool`), not errors-as-control-flow, so
   bootstrap decides what to log; a real error from either aborts startup
   the same as a database connection failure would.
5. **Services** — one `<module>.NewService(repo, ..., logger)` per module,
   each depending only on repository interfaces and other services it
   genuinely needs (see [modules.md](./modules.md)).
6. **Guards** — e.g. `guard.RequireBasicAuth(cfg.Auth...)`,
   `guard.RequireUserJWT(userJWTService)`. An authentication gate with fixed
   config is passed down as a built `api.Gate` (the same `RequireUserJWT`
   instance goes to both the `auth` and `user` handlers); a
   role-authorization gate like `guard.RequireRole` is parameterized per
   route group, so it's passed down as the bare factory (`guard.RoleGate`)
   instead — the module decides the roles, not bootstrap (see
   [auth-middleware.md](./auth-middleware.md)).
7. **Handlers** — one `<module>.NewHandler(service, gate...)` per module.
8. **Routes** — `api.New()`, mount the built SPA (`web.Handler()`) as the
   catch-all, then every `handler.RegisterRoutes(r, api.Serve)` under
   `config.APIPrefix` (see [api.md](./api.md)).
9. **Serve** — `http.ListenAndServe` + graceful shutdown.

Adding a new module means adding one line to steps 2 and 5–8 — see the
`create-backend-module` skill's bootstrap step for the exact checklist.

## Import aliasing

Hyphenated module directories (e.g. `api-key`) can't be imported under
their literal package name, so `bootstrap` (and anything else importing
them) aliases: `apikey "github.com/.../module/api-key"`.
