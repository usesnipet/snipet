package llmprovider

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/internal/api"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) api.Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/llm-provider", func(r chi.Router) {
		r.Get("/", serve(h.filter))
		r.Get("/registry", serve(h.listProvidersFromRegistry))
		r.Post("/", serve(h.create))
		r.Get("/{id}", serve(h.findByID))
		r.Put("/{id}", serve(h.update))
		r.Delete("/{id}", serve(h.deleteByID))
	})
}

// @Summary		List LlmProviders
// @Tags			llm-provider
// @Produce		json
// @Success		200	{object}	page.Paginated[model.LlmProvider]
// @Router			/llm-provider [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var dto FindLlmProvidersFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Filter(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Create a LlmProvider
// @Tags			llm-provider
// @Accept			json
// @Produce		json
// @Param			body	body		CreateLlmProviderDTO	true	"payload"
// @Success		201		{object}	model.LlmProvider
// @Router			/llm-provider [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var dto CreateLlmProviderDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	created, err := h.service.Create(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusCreated, created)
}

// @Summary		Get a LlmProvider by ID
// @Tags			llm-provider
// @Produce		json
// @Param			id	path		string	true	"LlmProvider ID"
// @Success		200	{object}	model.LlmProvider
// @Router			/llm-provider/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	found, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}

// @Summary		Update a LlmProvider
// @Tags			llm-provider
// @Accept			json
// @Param			id		path	string			true	"LlmProvider ID"
// @Param			body	body	UpdateLlmProviderDTO	true	"partial payload"
// @Success		204
// @Router			/llm-provider/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	var dto UpdateLlmProviderDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.Update(r.Context(), chi.URLParam(r, "id"), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Delete a LlmProvider
// @Tags			llm-provider
// @Param			id	path	string	true	"LlmProvider ID"
// @Success		204
// @Router			/llm-provider/{id} [delete]
func (h *Handler) deleteByID(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteByID(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		List LLM providers
// @Description	Lists the available LLM provider providers.
// @Tags			llm
// @Produce		json
// @Security		BasicAuth
// @Success		200			{array}		DriverInfo
// @Failure		400			{object}	api.Error
// @Router			/llm/providers [get]
func (h *Handler) listProvidersFromRegistry(w http.ResponseWriter, r *http.Request) error {
	providers, err := h.service.ListProvidersFromRegistry(r.Context())
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, providers)
}
