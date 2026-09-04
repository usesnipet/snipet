package apikey

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/internal/api"
	"github.com/usesnipet/snipet/internal/model"
)

// Handler takes api.Gate, not a pre-built api.MiddlewareFunc — bootstrap
// hands over the raw Gate (e.g. guard.RequireBasicAuth(...)) and the
// handler decides how to turn it into middleware itself, via .Handler() or,
// for a route that should accept more than one auth scheme, api.Or(...)
// composed here. Gate lives in internal/api rather than internal/guard so
// this works even though internal/guard imports this package back (for
// RequireApiKey's Service dependency) — importing internal/guard here
// would be a cycle.
type Handler struct {
	service     *Service
	requireRole api.RoleGate
	apiKeyGate  api.Gate
}

func NewHandler(service *Service, requireRole api.RoleGate, apiKeyGate api.Gate) api.Handler {
	return &Handler{service: service, requireRole: requireRole, apiKeyGate: apiKeyGate}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/api-keys", func(r chi.Router) {
		r.Use(h.requireRole(model.RoleAdmin).Handler())
		r.Get("/", serve(h.filter))
		r.Post("/", serve(h.create))
		r.Get("/{id}", serve(h.findByID))
		r.Post("/{id}/roll", serve(h.roll))
		r.Put("/{id}/expiration", serve(h.updateExpiration))
		r.Put("/{id}/active", serve(h.toggleActive))
		r.Put("/{id}/disabled", serve(h.toggleDisabled))
		r.Delete("/{id}", serve(h.delete))
	})

	// /api-key/me only makes sense called WITH an API key — it introspects
	// whichever key authenticated the request — so it stays on
	// apiKeyGate instead of moving under /api-keys.
	r.Route("/api-key/me", func(r chi.Router) {
		r.Use(h.apiKeyGate.Handler())
		r.Get("/", serve(h.me))
	})
}

// @Summary		List API keys
// @Description	Lists API keys, with optional pagination.
// @Tags			api-key
// @Produce		json
// @Security		BasicAuth
// @Param			take		query		int		false	"Page size"
// @Param			skip		query		int		false	"Page offset"
// @Success		200			{object}	APIKeysPage
// @Failure		400			{object}	api.Error
// @Router			/api-keys [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var query FindAPIKeysFilterDTO
	if err := api.ParseQuery(r, &query); err != nil {
		return err
	}
	data, err := h.service.Filter(r.Context(), query.ToFilter())
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, data)
}

// @Summary		Get current API key
// @Description	Returns the API key used to authenticate the current request.
// @Tags			api-key
// @Produce		json
// @Security		ApiKeyAuth
// @Success		200	{object}	APIKeyResponse
// @Failure		401	{object}	api.Error
// @Router			/api-key/me [get]
func (h *Handler) me(w http.ResponseWriter, r *http.Request) error {
	data, err := h.service.Me(r.Context())
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, data)
}

// @Summary		Get API key
// @Description	Returns an API key by ID.
// @Tags			api-key
// @Produce		json
// @Security		BasicAuth
// @Param			id			path		string	true	"API key ID"
// @Success		200			{object}	APIKeyResponse
// @Failure		404			{object}	api.Error
// @Router			/api-keys/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	data, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, data)
}

// @Summary		Create API key
// @Description	Creates a new API key. The plaintext key is only returned once, on creation.
// @Tags			api-key
// @Accept			json
// @Produce		json
// @Security		BasicAuth
// @Param			body		body		CreateAPIKeyDTO	true	"API key data"
// @Success		201			{object}	APIKeyWithSecret
// @Failure		400			{object}	api.Error
// @Router			/api-keys [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var dto CreateAPIKeyDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	data, err := h.service.Create(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusCreated, data)
}

// @Summary		Roll API key
// @Description	Rotates an API key, invalidating the previous secret. The new plaintext key is only returned once.
// @Tags			api-key
// @Produce		json
// @Security		BasicAuth
// @Param			id			path		string	true	"API key ID"
// @Success		200			{object}	APIKeyWithSecret
// @Failure		404			{object}	api.Error
// @Router			/api-keys/{id}/roll [post]
func (h *Handler) roll(w http.ResponseWriter, r *http.Request) error {
	data, err := h.service.Roll(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, data)
}

// @Summary		Update API key expiration
// @Description	Updates the expiration date of an API key.
// @Tags			api-key
// @Accept			json
// @Security		BasicAuth
// @Param			id			path	string				true	"API key ID"
// @Param			body		body	UpdateExpirationDTO	true	"Expiration data"
// @Success		204
// @Failure		400	{object}	api.Error
// @Router			/api-keys/{id}/expiration [put]
func (h *Handler) updateExpiration(w http.ResponseWriter, r *http.Request) error {
	var dto UpdateExpirationDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.UpdateExpiration(r.Context(), chi.URLParam(r, "id"), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Activate API key
// @Description	Marks an API key as active.
// @Tags			api-key
// @Security		BasicAuth
// @Param			id			path	string	true	"API key ID"
// @Success		204
// @Failure		404	{object}	api.Error
// @Router			/api-keys/{id}/active [put]
func (h *Handler) toggleActive(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.ToggleActive(r.Context(), chi.URLParam(r, "id"), true); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Disable API key
// @Description	Marks an API key as disabled.
// @Tags			api-key
// @Security		BasicAuth
// @Param			id			path	string	true	"API key ID"
// @Success		204
// @Failure		404	{object}	api.Error
// @Router			/api-keys/{id}/disabled [put]
func (h *Handler) toggleDisabled(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.ToggleActive(r.Context(), chi.URLParam(r, "id"), false); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Delete API key
// @Description	Deletes an API key by ID.
// @Tags			api-key
// @Security		BasicAuth
// @Param			id			path	string	true	"API key ID"
// @Success		204
// @Failure		404	{object}	api.Error
// @Router			/api-keys/{id} [delete]
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.Delete(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}
