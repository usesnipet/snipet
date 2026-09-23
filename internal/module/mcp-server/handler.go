package mcpserver

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

// NewHandler builds the /mcp-server HTTP layer, admin-only: MCP servers run
// arbitrary commands and URLs on the host and their config holds credentials.
func NewHandler(service *Service, authGate api.Gate, requireRole api.RoleGate) api.Handler {
	return &Handler{service: service, authGate: authGate, requireRole: requireRole}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/mcp-server", func(r chi.Router) {
		r.Use(h.authGate.Handler())
		r.Use(h.requireRole(model.RoleAdmin).Handler())
		r.Get("/", serve(h.filter))
		r.Get("/registry", serve(h.listRegistry))
		r.Get("/registry/{key}", serve(h.getRegistryItem))
		r.Post("/", serve(h.create))
		r.Get("/{id}", serve(h.findByID))
		r.Put("/{id}", serve(h.update))
		r.Delete("/{id}", serve(h.deleteByID))
	})
}

// @Summary		List McpServers
// @Tags			mcp-server
// @Produce		json
// @Success		200	{object}	McpServersPage
// @Router			/mcp-server [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var dto FindMcpServersFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Filter(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Create a McpServer
// @Tags			mcp-server
// @Accept			json
// @Produce		json
// @Param			body	body		CreateMcpServerDTO	true	"payload"
// @Success		201		{object}	McpServerResponse
// @Router			/mcp-server [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var dto CreateMcpServerDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	created, err := h.service.Create(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusCreated, created)
}

// @Summary		Get a McpServer by ID
// @Tags			mcp-server
// @Produce		json
// @Param			id	path		string	true	"McpServer ID"
// @Success		200	{object}	McpServerResponse
// @Router			/mcp-server/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	found, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}

// @Summary		Update a McpServer
// @Tags			mcp-server
// @Accept			json
// @Param			id		path	string			true	"McpServer ID"
// @Param			body	body	UpdateMcpServerDTO	true	"partial payload"
// @Success		204
// @Router			/mcp-server/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	var dto UpdateMcpServerDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.Update(r.Context(), chi.URLParam(r, "id"), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Delete a McpServer
// @Tags			mcp-server
// @Param			id	path	string	true	"McpServer ID"
// @Success		204
// @Router			/mcp-server/{id} [delete]
func (h *Handler) deleteByID(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteByID(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		List MCP Servers Registry
// @Tags			mcp-server
// @Produce		json
// @Success		200	{array}		McpServerRegistryItem
// @Router			/mcp-server/registry [get]
func (h *Handler) listRegistry(w http.ResponseWriter, r *http.Request) error {
	return api.WriteJSON(w, http.StatusOK, h.service.ListRegistry())
}

// @Summary		Get a MCP Servers Registry item by key
// @Tags			mcp-server
// @Produce		json
// @Param			key	path		string	true	"Registry item key"
// @Success		200	{object}	McpServerRegistryItem
// @Router			/mcp-server/registry/{key} [get]
func (h *Handler) getRegistryItem(w http.ResponseWriter, r *http.Request) error {
	item, err := h.service.GetRegistryItem(chi.URLParam(r, "key"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, item)
}
