# `internal/module/<name>`

A module is one business domain (`system`, and whatever you add — `widget`,
`snipet`, ...): everything needed to expose CRUD (and any domain-specific
operations) for that entity over HTTP. Scaffolding one is covered
step-by-step by the
[`create-backend-module` skill](../../.claude/skills/create-backend-module/SKILL.md);
this doc explains why each file exists and how they relate.

## Anatomy

```
internal/module/<name>/
  dto.go        # request/response shapes + validation tags
  service.go     # business logic, talks to repositories
  handler.go      # HTTP layer: routes, parsing, status codes
  service_test.go  # tests service.go against mocked repositories
```

`system` is the shipped example — it has no repository (it just returns
`version.Version`), so it's the minimal shape. A CRUD module looks like the
`Widget` sketch below.

Domain CRUD belongs here — application logic never goes in `pkg/`.

## `dto.go`

Three DTO shapes per entity, each with a distinct job:

```go
type CreateWidgetDTO struct {
    Name string        `json:"name" validate:"required,max=255"`
    Spec jsonx.JSONMap `json:"spec" validate:"required"`
}

type UpdateWidgetDTO struct {
    Name *string       `json:"name" validate:"omitempty,max=255"`
    Spec jsonx.JSONMap `json:"spec" validate:"omitempty"`
}

type FindWidgetsFilterDTO struct {
    Take *int `form:"take" validate:"omitempty,min=1"`
    Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *FindWidgetsFilterDTO) ToFilter() *filter.Options[model.Widget] {
    return filter.New[model.Widget](filter.PtrTake(dto.Take), filter.PtrSkip(dto.Skip))
}
```

- **Create DTO** — value fields, `validate:"required"` on what the entity
  can't exist without.
- **Update DTO** — every field is a **pointer**, `validate:"omitempty"`.
  `nil` means "leave unchanged" — this is what makes `PUT` a partial patch
  instead of a full replace.
- **List/filter DTO** — `form:"..."` tags (parsed from query string by
  `api.ParseQuery`, see [api.md](./api.md)) plus a `ToFilter()` method that
  turns it into `*filter.Options[T]` (see
  [filter-page.md](./filter-page.md)). This is the only place query-string
  filtering logic lives — `service.go` just takes `*filter.Options[T]`.

## `service.go`

Owns business logic; depends on repository **interfaces** (never a concrete
`*XRepository`), so it's mockable in tests and swappable in wiring.

```go
type Service struct {
    repo repository.IWidgetRepository
}

func NewService(repo repository.IWidgetRepository) *Service {
    return &Service{repo: repo}
}
```

Standard method set: `Filter`, `FindByID`, `Create`, `Update`, `DeleteByID`
— thin pass-throughs to the repository when there's no extra logic, doing
real work only where the domain needs it.

**The pointer-fields-mean-partial-update pattern**, from `Widget.Update`:

```go
func (s *Service) Update(ctx context.Context, id string, dto UpdateWidgetDTO) error {
    existing, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return err
    }

    updates := &model.Widget{}
    if dto.Name != nil {
        updates.Name = *dto.Name
    }
    return s.repo.UpdateByID(ctx, id, updates)
}
```

Only fields the caller actually set get copied onto `updates`; everything
else stays at its Go zero value, which GORM's `Updates` call treats as "not
included in the `SET` clause" (see [repository.md](./repository.md)) — so an
omitted field in the request body genuinely means "don't touch this column."

**Domain errors** are returned as `*apperr.Error` (`apperr.BadRequest(...)`,
etc. — see [errors.md](./errors.md)), never a bare `errors.New(...)`, so the
HTTP layer knows the right status code without the service knowing about
HTTP at all.

**Multi-step writes** that touch more than one table go through
`repository.ITxManager.WithTransaction`.

## `handler.go`

The only layer that knows about HTTP. Constructs an `api.Handler` (see
[api.md](./api.md)):

```go
func NewHandler(service *Service, basicAuthGate api.Gate) api.Handler {
    return &Handler{service: service, basicAuthGate: basicAuthGate}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
    r.Route("/widget", func(r chi.Router) {
        r.Use(h.basicAuthGate.Handler())
        r.Get("/", serve(h.filter))
        r.Post("/", serve(h.create))
        r.Get("/{id}", serve(h.findByID))
        r.Put("/{id}", serve(h.update))
        r.Delete("/{id}", serve(h.deleteByID))
    })
}
```

- Route group + `r.Use(...)` is where a module wires its auth requirement
  (see [auth-middleware.md](./auth-middleware.md)). A module's `handler.go`
  is handed the `api.Gate`(s) it needs and calls `.Handler()` on them per
  route group. A gate with fixed config (like `basicAuthGate` above) is
  handed down pre-built; a gate parameterized per route group (role
  authorization — see `guard.RoleGate` in
  [auth-middleware.md](./auth-middleware.md#role-authorization--guardrequirerole))
  is handed down as the bare factory instead, and the handler calls it with
  its own roles.
- Every handler method has the shape `func(w, r) error` — parse with
  `api.ParseBody`/`api.ParseQuery`, call the service, write with
  `api.WriteJSON`/`api.WriteNoContent`, and just `return err` on failure.
  `serve(...)` (passed in from `bootstrap`) turns that returned error into
  the actual HTTP response.
- Status codes: list/get → `200`, create → `201`, update/delete → `204`
  (`api.WriteNoContent`). Path params via `chi.URLParam(r, "id")`.

## `service_test.go`

External test package (`package widget_test`), `t.Parallel()`, testify +
generated mocks:

```go
repo := mocks.NewMockIWidgetRepository(t)
repo.EXPECT().Create(mock.Anything, mock.Anything).Return(nil)
svc := newTestService(repo)
```

A `newTestService(repo, ...)` helper wires real collaborators when they're
cheap (a hasher, a logger) and mocks when they're not (repositories).
Assert domain failures by checking the returned `*apperr.Error`'s
status/message, not just that an error occurred.

## Wiring

A module's `Service`/`Handler` don't construct their own dependencies —
`internal/bootstrap` builds the repository, then the service, then the
handler, in that snipet, and calls `RegisterRoutes`. See
[bootstrap.md](./bootstrap.md).
