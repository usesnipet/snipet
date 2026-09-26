package tool

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

// NewHandler builds the /tool HTTP layer, admin-only: executing a tool acts
// on the host through its MCP server, and tools embed that server's config.
func NewHandler(service *Service, authGate api.Gate, requireRole api.RoleGate) api.Handler {
	return &Handler{service: service, authGate: authGate, requireRole: requireRole}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/tool", func(r chi.Router) {
		r.Use(h.authGate.Handler())
		r.Use(h.requireRole(model.RoleAdmin).Handler())
		r.Get("/", serve(h.filter))
		r.Get("/{id}", serve(h.findByID))
		r.Post("/{id}/execute", serve(h.execute))
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

// @Summary		Execute a Tool
// @Tags			tool
// @Accept			json
// @Produce		json
// @Param			id		path		string			true	"Tool ID"
// @Param			body	body		ExecuteToolDTO	true	"Tool arguments"
// @Success		200		{object}	ExecuteToolResponse
// @Router			/tool/{id}/execute [post]
func (h *Handler) execute(w http.ResponseWriter, r *http.Request) error {
	var dto ExecuteToolDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Execute(r.Context(), chi.URLParam(r, "id"), dto.Arguments)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}
