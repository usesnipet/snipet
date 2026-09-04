package llmconnection

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
	r.Route("/llm-connection", func(r chi.Router) {
		r.Get("/", serve(h.filter))
		r.Get("/providers", serve(h.listProviders))
		r.Post("/", serve(h.create))
		r.Get("/{id}", serve(h.findByID))
		r.Put("/{id}", serve(h.update))
		r.Delete("/{id}", serve(h.deleteByID))
	})
}

// @Summary		List LlmConnections
// @Tags			llm-connection
// @Produce		json
// @Success		200	{object}	LLMConnectionsPage
// @Router			/llm-connection [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var dto FindLlmConnectionsFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Filter(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Create a LlmConnection
// @Tags			llm-connection
// @Accept			json
// @Produce		json
// @Param			body	body		CreateLlmConnectionDTO	true	"payload"
// @Success		201		{object}	LLMConnectionResponse
// @Router			/llm-connection [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var dto CreateLlmConnectionDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	created, err := h.service.Create(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusCreated, created)
}

// @Summary		Get a LlmConnection by ID
// @Tags			llm-connection
// @Produce		json
// @Param			id	path		string	true	"LlmConnection ID"
// @Success		200	{object}	LLMConnectionResponse
// @Router			/llm-connection/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	found, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}

// @Summary		Update a LlmConnection
// @Tags			llm-connection
// @Accept			json
// @Param			id		path	string			true	"LlmConnection ID"
// @Param			body	body	UpdateLlmConnectionDTO	true	"partial payload"
// @Success		204
// @Router			/llm-connection/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	var dto UpdateLlmConnectionDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.Update(r.Context(), chi.URLParam(r, "id"), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Delete a LlmConnection
// @Tags			llm-connection
// @Param			id	path	string	true	"LlmConnection ID"
// @Success		204
// @Router			/llm-connection/{id} [delete]
func (h *Handler) deleteByID(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteByID(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		List LLM provider
// @Description	Lists the available LLM providers.
// @Tags			llm-connection
// @Produce		json
// @Security		BasicAuth
// @Success		200			{array}		LLMProviderRegistry
// @Failure		400			{object}	api.Error
// @Router			/llm-connection/providers [get]
func (h *Handler) listProviders(w http.ResponseWriter, r *http.Request) error {
	providers, err := h.service.ListProviders(r.Context())
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, providers)
}
