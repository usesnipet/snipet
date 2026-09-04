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

## Role authorization — `guard.RequireRole`

Authentication (who is this?) and authorization (are they allowed?) are two
separate gates, chained in sequence — not one gate doing both, and not a
check living inside the service:

```go
r.Use(h.authGate.Handler())                       // authenticate: populates auth.CurrentUser
r.Use(h.requireRole(model.RoleAdmin).Handler())    // authorize: rejects the wrong role
```

`guard.RequireRole(roles ...model.Role) api.Gate` reads `auth.CurrentUser(ctx)`
(so it must run after a gate that calls `auth.SetUserIdentity`) and returns
`apperr.Forbidden(...)` when the caller's role isn't in the allowed set.
Unlike the authentication gates above, it always resolves — it never
returns `auth.ErrNotApplicable` — so it isn't meant to compose with `api.Or`.

**`RequireRole` is a factory, not a pre-built gate** — the roles a route
group needs are that module's decision, not bootstrap's. So bootstrap
builds it once and hands down the bare function (typed `guard.RoleGate` —
`func(roles ...model.Role) api.Gate`), and each module's `handler.go` calls
it with its own roles:

```go
// bootstrap.go
requireRole := guard.RequireRole
userHandler := usermodule.NewHandler(userService, requireUserAuth, requireRole)

// module/user/handler.go
func NewHandler(service *Service, authGate api.Gate, requireRole guard.RoleGate) api.Handler {
    return &Handler{service: service, authGate: authGate, requireRole: requireRole}
}
```

This is why a module needing role authorization takes a `guard.RoleGate`
parameter instead of a plain `api.Gate` like `basicAuthGate` in
[modules.md](./modules.md) — a pre-built gate can't be re-parameterized per
route group the way a factory can.

**Why authorization moved out of the service:** an admin-only check baked
into a service method also blocks that method from being called for
self-service (a user changing their own password calls the same
`Update` a `/users` admin route calls, from `/auth/me/password`). Keeping
services caller-agnostic and gating at the route instead makes both
callers work. A service still enforces domain invariants that aren't about
*who's* calling — e.g. the users module refusing to delete the last
remaining admin — those stay in the service because they'd be wrong for
every caller, not just unprivileged ones.

## Failure path

Guards run *outside* the `HandlerFunc`/`api.Serve` flow (see
[api.md](./api.md)) — on failure they write the error response themselves
and never call `next`. `Gate.Handler()` never hardcodes a status: it writes
whatever `*apperr.Error` the gate itself returned (`RequireBasicAuth` and
`Or`'s fallback both use `apperr.Unauthorized`, `guard.RequireRole` uses
`apperr.Forbidden`), and only falls back to `apperr.Unauthorized` for a gate
that broke convention and returned a bare `error`. Every gate in this
codebase should return an `*apperr.Error`, never a bare `error`, so that
fallback is never expected to trigger. A `Forbidden` returned from *inside*
a service method (a domain invariant, not a route gate) takes the ordinary
path instead: it flows back through `*apperr.Error` → `api.Serve` →
HTTP-status like any other domain error (see [errors.md](./errors.md)).
