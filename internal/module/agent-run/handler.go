package agentrun

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/internal/api"
	apperr "github.com/usesnipet/snipet/internal/app-err"
)

type Handler struct {
	service    *Service
	authGate   api.Gate
	apiKeyGate api.Gate
}

// NewHandler builds the /agent-run and /agent-session HTTP layer, open to any
// signed-in user or API key; the agent's grants bound what a run can do.
func NewHandler(service *Service, authGate api.Gate, apiKeyGate api.Gate) api.Handler {
	return &Handler{service: service, authGate: authGate, apiKeyGate: apiKeyGate}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	gate := api.Or(h.apiKeyGate, h.authGate).Handler()
	r.Route("/agent-run", func(r chi.Router) {
		r.Use(gate)
		r.Post("/", serve(h.start))
		r.Get("/", serve(h.filterRuns))
		r.Get("/{id}", serve(h.findRun))
		r.Get("/{id}/events", serve(h.events))
		r.Post("/{id}/cancel", serve(h.cancel))
	})
	r.Route("/agent-session", func(r chi.Router) {
		r.Use(gate)
		r.Get("/", serve(h.filterSessions))
		r.Get("/{id}", serve(h.findSession))
		r.Delete("/{id}", serve(h.deleteSession))
		r.Get("/{id}/messages", serve(h.filterMessages))
	})
}

// @Summary		Start an agent run
// @Description	Saves the input as a user message and runs the agent in the background. No session_id starts a new session.
// @Tags			agent-run
// @Accept			json
// @Produce		json
// @Param			body	body		StartRunDTO	true	"payload"
// @Success		202		{object}	AgentRunResponse
// @Failure		409		{object}	api.Error
// @Router			/agent-run [post]
func (h *Handler) start(w http.ResponseWriter, r *http.Request) error {
	var dto StartRunDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	run, err := h.service.Start(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusAccepted, run)
}

// @Summary		List the runs of a session
// @Tags			agent-run
// @Produce		json
// @Param			session_id	query		string	true	"Session ID"
// @Success		200			{object}	AgentRunsPage
// @Router			/agent-run [get]
func (h *Handler) filterRuns(w http.ResponseWriter, r *http.Request) error {
	var dto FindRunsFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.FilterRuns(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Get an agent run by ID
// @Tags			agent-run
// @Produce		json
// @Param			id	path		string	true	"Run ID"
// @Success		200	{object}	AgentRunResponse
// @Router			/agent-run/{id} [get]
func (h *Handler) findRun(w http.ResponseWriter, r *http.Request) error {
	run, err := h.service.FindRun(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, run)
}

// @Summary		Stream an agent run's events
// @Description	Server-Sent Events: stored messages after Last-Event-ID, then live events ("run_started", "turn_started", "llm_started", "llm_skipped", "text_delta", "tool_call_started", "message", "run_finished"). Only "message" events carry an id.
// @Tags			agent-run
// @Produce		text/event-stream
// @Param			id				path	string	true	"Run ID"
// @Param			Last-Event-ID	header	int		false	"Last message id received"
// @Success		200
// @Router			/agent-run/{id}/events [get]
func (h *Handler) events(w http.ResponseWriter, r *http.Request) error {
	var lastID int64
	if v := r.Header.Get("Last-Event-ID"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return apperr.BadRequest("invalid Last-Event-ID")
		}
		lastID = id
	}
	// Check access before switching the response to SSE, so errors are JSON.
	if _, err := h.service.FindRun(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}

	sse, err := api.NewSSEWriter(w)
	if err != nil {
		return err
	}
	err = h.service.Events(r.Context(), chi.URLParam(r, "id"), lastID, func(ev Event) error {
		if ev.ID > 0 {
			return sse.WriteID(ev.ID, ev.Type, ev.Data)
		}
		return sse.Write(ev.Type, ev.Data)
	})
	if err != nil {
		_ = sse.Write("error", map[string]string{"message": err.Error()})
	}
	return nil
}

// @Summary		Cancel an agent run
// @Tags			agent-run
// @Param			id	path	string	true	"Run ID"
// @Success		204
// @Router			/agent-run/{id}/cancel [post]
func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.Cancel(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		List agent sessions
// @Description	Users see their own sessions; admins and API keys see all, optionally filtered by subject.
// @Tags			agent-session
// @Produce		json
// @Success		200	{object}	AgentSessionsPage
// @Router			/agent-session [get]
func (h *Handler) filterSessions(w http.ResponseWriter, r *http.Request) error {
	var dto FindSessionsFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.FilterSessions(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Get an agent session by ID
// @Tags			agent-session
// @Produce		json
// @Param			id	path		string	true	"Session ID"
// @Success		200	{object}	AgentSessionResponse
// @Router			/agent-session/{id} [get]
func (h *Handler) findSession(w http.ResponseWriter, r *http.Request) error {
	session, err := h.service.FindSession(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, session)
}

// @Summary		Delete an agent session
// @Tags			agent-session
// @Param			id	path	string	true	"Session ID"
// @Success		204
// @Failure		409	{object}	api.Error
// @Router			/agent-session/{id} [delete]
func (h *Handler) deleteSession(w http.ResponseWriter, r *http.Request) error {
	if err := h.service.DeleteSession(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		List a session's messages
// @Description	Newest first; page back with before=<oldest id received>.
// @Tags			agent-session
// @Produce		json
// @Param			id		path		string	true	"Session ID"
// @Param			take	query		int		false	"Page size (default 50)"
// @Param			before	query		int		false	"Only messages with a smaller id"
// @Success		200		{object}	AgentMessagesPage
// @Router			/agent-session/{id}/messages [get]
func (h *Handler) filterMessages(w http.ResponseWriter, r *http.Request) error {
	var dto FindMessagesFilterDTO
	if err := api.ParseQuery(r, &dto); err != nil {
		return err
	}
	result, err := h.service.FilterMessages(r.Context(), chi.URLParam(r, "id"), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}
