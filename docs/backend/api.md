# `internal/api`

A thin layer over [chi](https://github.com/go-chi/chi) that gives every
handler a consistent shape: handlers return an `error` instead of writing
error responses themselves, and one place (`Serve`) turns that error into
the right HTTP status/body.

## `Api` and the base router

```go
type Api struct {
    Router *chi.Mux
}

func New() *Api {
    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RequestID)
    r.Use(middleware.ClientIPFromRemoteAddr)
    return &Api{Router: r}
}
```

Built once in `bootstrap.Bootstrap` (see [bootstrap.md](./bootstrap.md)).
Module handlers are registered under `config.APIPrefix` (`/api`); everything
else falls through to serving the built `web/` SPA.

## `Handler`, `HandlerFunc`, `ServeFunc`

```go
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

type Handler interface {
    RegisterRoutes(r chi.Router, serve ServeFunc)
}

type ServeFunc func(handler HandlerFunc) http.HandlerFunc
```

Every module's `Handler` (see [modules.md](./modules.md)) implements
`RegisterRoutes`, registering routes with `serve(h.someMethod)` where
`someMethod` has the `HandlerFunc` shape — return an `error` instead of
writing it to `w` directly:

```go
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
    data, err := h.service.FindByID(r.Context(), h.llmID(r))
    if err != nil {
        return err
    }
    return api.WriteJSON(w, http.StatusOK, data)
}
```

## `Serve` — the error-to-response translator

```go
func (a *Api) Serve(handler HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if err := handler(w, r); err != nil {
            var appErr *apperr.Error
            if errors.As(err, &appErr) {
                WriteAppError(w, appErr)
                return
            }
            if err, ok := database.HandleDBError(err); ok {
                WriteAppError(w, err)
                return
            }
            WriteError(w, http.StatusInternalServerError, err)
        }
    }
}
```

This is *the* reason a service/handler should return `*apperr.Error` (see
[errors.md](./errors.md)) instead of a bare error: `Serve` recognizes it and
writes the matching status code + JSON body. A raw GORM error is still
handled gracefully (`database.HandleDBError` maps known DB errors, e.g. a
unique constraint violation, to an `apperr.Error`); anything else becomes a
generic `500`. A handler function never needs its own `try/catch`-style
error branching — just `return err` and let `Serve` sort it out.

`bootstrap` passes `api.Serve` (the `Api` instance's method) into every
`handler.RegisterRoutes(r, api.Serve)` call, so `ServeFunc` in a module's
`handler.go` is always this same translator.

## `ParseBody` / `ParseQuery`

```go
func ParseBody[T any](r *http.Request, v *T) error {
    // json.Decode, then validator.Struct, then mold's conform.Struct
}

func ParseQuery[T any](r *http.Request, v *T) error {
    // go-playground/form decode from r.URL.Query(), then validate, then conform
}
```

Both decode into a DTO (see [modules.md](./modules.md)), run
`go-playground/validator` against its `validate:"..."` tags, then run
`go-playground/mold`'s `conform` against any `mold:"..."` tags (trimming,
casing, etc.) — and both return an `apperr.BadRequest(...)` on any failure,
so a handler that calls them can just `return err`.

- `ParseBody` — JSON request bodies, DTO fields tagged `json:"..."`.
- `ParseQuery` — query strings, DTO fields tagged `form:"..."` (see
  `FindWidgetsFilterDTO` in [modules.md](./modules.md)).

## `WriteJSON` / `WriteNoContent` / `WriteError` / `WriteAppError`

```go
func WriteJSON(w http.ResponseWriter, status int, data any) error
func WriteNoContent(w http.ResponseWriter) error
func WriteAppError(w http.ResponseWriter, err *apperr.Error) error
func WriteError(w http.ResponseWriter, status int, err error) error
```

`WriteJSON`/`WriteNoContent` are what a handler calls on the success path.
`WriteError`/`WriteAppError` are what the failure path calls instead: `Serve`
uses `WriteError` for an error it can't type-assert to `*apperr.Error`
(a generic `500`) and `WriteAppError` once it has one. `Gate.Handler()`
(middleware, which sits outside the `HandlerFunc`/`Serve` flow and has to
write errors itself — see [auth-middleware.md](./auth-middleware.md)) only
ever calls `WriteAppError`, since every gate is expected to already fail
with an `*apperr.Error`. A handler itself generally never calls these
directly, it just returns the error and lets `Serve` do it.

## SSE

```go
sse, err := api.NewSSEWriter(w)   // sets text/event-stream headers, flushes
sse.Write("event-name", payload)  // marshals payload, writes an SSE frame, flushes
```

For endpoints that stream instead of returning one JSON response. Because
`SSEWriter` already wrote the response by the time an error can occur
mid-stream, a handler using it can't rely on `Serve`'s error handling — it
has to write its own `error` frame and `return nil`.
