package tool

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/internal/api"
)

type Handler struct {
	service    *Service
	authGate   api.Gate
	apiKeyGate api.Gate
}

func NewHandler(service *Service, authGate api.Gate, apiKeyGate api.Gate) api.Handler {
	return &Handler{service: service, authGate: authGate, apiKeyGate: apiKeyGate}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/tool", func(r chi.Router) {
		r.Use(api.Or(h.apiKeyGate, h.authGate).Handler())
		r.Get("/", serve(h.filter))
		r.Get("/{id}", serve(h.findByID))
		r.Delete("/{id}", serve(h.deleteByID))
	})
}

// @Summary		List Tools
// @Tags			tool
// @Produce		json
// @Success		200	{object}	ToolsPage
// @Router			/tool [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var dto FindToolsFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Filter(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Get a Tool by ID
// @Tags			tool
// @Produce		json
// @Param			id	path		string	true	"Tool ID"
// @Success		200	{object}	ToolResponse
// @Router			/tool/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	found, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}

// @Summary		Delete a Tool
// @Tags			tool
// @Param			id	path	string	true	"Tool ID"
// @Success		204
// @Router			/tool/{id} [delete]
func (h *Handler) deleteByID(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteByID(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}
