---
to: internal/module/<%= h.kebab(name) %>/handler.go
sh: gofmt -w internal/module/<%= h.kebab(name) %>/handler.go
---
<% const P = h.pascal(name); const kebab = h.kebab(name); -%>
package <%= h.pkgName(name) %>

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"<%= h.goModule() %>/internal/api"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) api.Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/<%= kebab %>", func(r chi.Router) {
		r.Get("/{id}", serve(h.findByID))
		// add routes as the service grows
	})
}

// @Summary		Get a <%= P %> by ID
// @Tags			<%= kebab %>
// @Produce		json
// @Param			id	path		string	true	"<%= P %> ID"
// @Success		200	{object}	model.<%= P %>
// @Router			/<%= kebab %>/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	found, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}
