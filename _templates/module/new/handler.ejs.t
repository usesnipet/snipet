---
to: internal/module/<%= h.kebab(name) %>/handler.go
sh: gofmt -w internal/module/<%= h.kebab(name) %>/handler.go
---
<% const P = h.pascal(name); const Plural = h.pluralPascal(name); const kebab = h.kebab(name); -%>
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
		r.Get("/", serve(h.filter))
		r.Post("/", serve(h.create))
		r.Get("/{id}", serve(h.findByID))
		r.Put("/{id}", serve(h.update))
		r.Delete("/{id}", serve(h.deleteByID))
	})
}

// @Summary		List <%= Plural %>
// @Tags			<%= kebab %>
// @Produce		json
// @Success		200	{object}	page.Paginated[model.<%= P %>]
// @Router			/<%= kebab %> [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var dto Find<%= Plural %>FilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Filter(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Create a <%= P %>
// @Tags			<%= kebab %>
// @Accept			json
// @Produce		json
// @Param			body	body		Create<%= P %>DTO	true	"payload"
// @Success		201		{object}	model.<%= P %>
// @Router			/<%= kebab %> [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var dto Create<%= P %>DTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	created, err := h.service.Create(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusCreated, created)
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

// @Summary		Update a <%= P %>
// @Tags			<%= kebab %>
// @Accept			json
// @Param			id		path	string			true	"<%= P %> ID"
// @Param			body	body	Update<%= P %>DTO	true	"partial payload"
// @Success		204
// @Router			/<%= kebab %>/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	var dto Update<%= P %>DTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.Update(r.Context(), chi.URLParam(r, "id"), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Delete a <%= P %>
// @Tags			<%= kebab %>
// @Param			id	path	string	true	"<%= P %> ID"
// @Success		204
// @Router			/<%= kebab %>/{id} [delete]
func (h *Handler) deleteByID(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteByID(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}
