package user

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/internal/api"
	"github.com/usesnipet/snipet/internal/model"
)

type Handler struct {
	service     *Service
	authGate    api.Gate
	requireRole api.RoleGate
}

// NewHandler builds the users HTTP layer. authGate authenticates the caller
// (JWT — see the Auth guards issue); requireRole is the role-gate factory
// (guard.RequireRole) bootstrap builds once — this handler is the one that
// decides which roles it needs (admin, for the whole /users group), not
// bootstrap.
func NewHandler(service *Service, authGate api.Gate, requireRole api.RoleGate) api.Handler {
	return &Handler{service: service, authGate: authGate, requireRole: requireRole}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/users", func(r chi.Router) {
		r.Use(h.authGate.Handler())
		r.Use(h.requireRole(model.RoleAdmin).Handler())
		r.Get("/", serve(h.filter))
		r.Post("/", serve(h.create))
		r.Get("/{id}", serve(h.findByID))
		r.Put("/{id}", serve(h.update))
		r.Delete("/{id}", serve(h.deleteByID))
	})
}

// @Summary		List users
// @Tags			users
// @Produce		json
// @Success		200	{object}	UsersPage
// @Failure		403	{object}	api.Error
// @Router			/users [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var dto FindUsersFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Filter(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Create a user
// @Tags			users
// @Accept			json
// @Produce		json
// @Param			body	body		CreateUserDTO	true	"payload"
// @Success		201		{object}	UserResponse
// @Failure		400		{object}	api.Error
// @Failure		403		{object}	api.Error
// @Failure		409		{object}	api.Error
// @Router			/users [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var dto CreateUserDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	created, err := h.service.Create(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusCreated, created)
}

// @Summary		Get a user by ID
// @Tags			users
// @Produce		json
// @Param			id	path		string	true	"User ID"
// @Success		200	{object}	UserResponse
// @Failure		403	{object}	api.Error
// @Failure		404	{object}	api.Error
// @Router			/users/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	found, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}

// @Summary		Update a user
// @Tags			users
// @Accept			json
// @Param			id		path	string			true	"User ID"
// @Param			body	body	UpdateUserDTO	true	"partial payload"
// @Success		204
// @Failure		400	{object}	api.Error
// @Failure		403	{object}	api.Error
// @Failure		404	{object}	api.Error
// @Router			/users/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	var dto UpdateUserDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.Update(r.Context(), chi.URLParam(r, "id"), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Delete a user
// @Tags			users
// @Param			id	path	string	true	"User ID"
// @Success		204
// @Failure		403	{object}	api.Error
// @Failure		404	{object}	api.Error
// @Router			/users/{id} [delete]
func (h *Handler) deleteByID(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteByID(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}
