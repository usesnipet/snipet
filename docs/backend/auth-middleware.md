# `internal/auth` + `internal/guard`

Two layers, two different jobs:

- **`internal/auth`** — JWT signing/verification, API-key generation and
  hashing, password hashing, and the per-mechanism *identity* types +
  context helpers. Knows nothing about HTTP.
- **`internal/guard`** — composable `Gate`s that run those primitives
  against an incoming request and stash the resulting identity on the
  context.

The skeleton wires **one** mechanism: admin basic auth. The `auth` package
also ships JWT (`JWTService[T]`), API-key (`APIKeyGenerator`, `KeyHasher`),
and password primitives ready for a module you add (e.g. an `api-key`
module scaffolded with the skill).

## Admin basic auth

| Mechanism | Credential | Identity type | Set by |
|---|---|---|---|
| Admin basic auth | `Authorization: Basic` | `auth.BasicIdentity` (`Username`) | `guard.RequireBasicAuth` |

```go
type BasicIdentity struct {
    Username string
}
```

A single username/password pair from `config.AuthConfig`
(`AUTH_BASIC_AUTH_USERNAME` / `AUTH_BASIC_AUTH_PASSWORD`), compared in
constant time. There is no user table to look up.

Read it back inside a handler/service:

```go
identity, err := auth.CurrentBasic(ctx) // auth.BasicIdentity, err if not authenticated
```

## Guards — gates + `api.Or`

Every guard constructor returns an `api.Gate`
(`func(*http.Request) (context.Context, error)`):

```go
requireBasicAuth := guard.RequireBasicAuth(cfg.Auth.BasicAuthUsername, cfg.Auth.BasicAuthPassword)

r.Use(requireBasicAuth.Handler())
```

`api.Or` (in [`internal/api`](./api.md)) composes several gates — the first
one whose credential is present decides the outcome:

- credential **absent** → try the next gate (`auth.ErrNotApplicable`)
- credential **present but invalid** → hard 401 (does not fall through)
- credential **valid** → sets that identity on the context, done

Gates are built once in `bootstrap.Bootstrap` (see
[bootstrap.md](./bootstrap.md)) and handed to modules as raw `api.Gate`s —
a module's `handler.go` decides which gate(s) to `r.Use(...)` per route
group via `.Handler()` (see [modules.md](./modules.md)).

## Adding a JWT-authenticated route

`auth.JWTService[T]` is generic over a claims type. Define your claims by
embedding `auth.BaseClaims` (see `auth.UserClaims` for the shape), build a
`guard` gate that calls `VerifyToken`, and set an identity on the context
the way `RequireBasicAuth` does. `guard.verifyBearerJWT` is a ready helper
for extracting and verifying the bearer token.

## Failure path

Guards run *outside* the `HandlerFunc`/`api.Serve` flow (see
[api.md](./api.md)) — on an auth failure they write the error response
themselves and never call `next`. A `Forbidden` returned from *inside* a
service method is the opposite: it flows back through the normal
`*apperr.Error` → `api.Serve` → HTTP-status path like any other domain
error (see [errors.md](./errors.md)).
