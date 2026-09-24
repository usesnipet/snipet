package agent

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

// NewHandler builds the /agent HTTP layer, admin-only: an agent's grants
// decide which tools any user running it can reach.
func NewHandler(service *Service, authGate api.Gate, requireRole api.RoleGate) api.Handler {
	return &Handler{service: service, authGate: authGate, requireRole: requireRole}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/agent", func(r chi.Router) {
		r.Use(h.authGate.Handler())
		r.Use(h.requireRole(model.RoleAdmin).Handler())
		r.Get("/", serve(h.filter))
		r.Post("/", serve(h.create))
		r.Get("/{id}", serve(h.findByID))
		r.Put("/{id}", serve(h.update))
		r.Delete("/{id}", serve(h.deleteByID))
		r.Get("/{id}/tools", serve(h.findTools))
	})
}

// @Summary		List Agents
// @Tags			agent
// @Produce		json
// @Success		200	{object}	AgentsPage
// @Router			/agent [get]
func (h *Handler) filter(w http.ResponseWriter, r *http.Request) error {
	var dto FindAgentsFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Filter(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Create an Agent
// @Tags			agent
// @Accept			json
// @Produce		json
// @Param			body	body		CreateAgentDTO	true	"payload"
// @Success		201		{object}	AgentResponse
// @Router			/agent [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var dto CreateAgentDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	created, err := h.service.Create(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusCreated, created)
}

// @Summary		Get an Agent by ID
// @Tags			agent
// @Produce		json
// @Param			id	path		string	true	"Agent ID"
// @Success		200	{object}	AgentResponse
// @Router			/agent/{id} [get]
func (h *Handler) findByID(w http.ResponseWriter, r *http.Request) error {
	found, err := h.service.FindByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}

// @Summary		Update an Agent
// @Tags			agent
// @Accept			json
// @Param			id		path	string			true	"Agent ID"
// @Param			body	body	UpdateAgentDTO	true	"partial payload"
// @Success		204
// @Router			/agent/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	var dto UpdateAgentDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.Update(r.Context(), chi.URLParam(r, "id"), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Delete an Agent
// @Tags			agent
// @Param			id	path	string	true	"Agent ID"
// @Success		204
// @Router			/agent/{id} [delete]
func (h *Handler) deleteByID(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteByID(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		List the tools an Agent can call
// @Description	Tools as sent to the LLM, named "<server>__<tool>".
// @Tags			agent
// @Produce		json
// @Param			id	path		string	true	"Agent ID"
// @Success		200	{array}		AgentToolResponse
// @Router			/agent/{id}/tools [get]
func (h *Handler) findTools(w http.ResponseWriter, r *http.Request) error {
	tools, err := h.service.FindTools(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, tools)
}
