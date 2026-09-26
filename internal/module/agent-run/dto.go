package agentrun

import (
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
)

// Aliases so swagger annotations in this package can name plain types —
// swag can't parse generic instantiations inline.
type (
	AgentRunResponse     = model.AgentRun
	AgentRunsPage        = page.Paginated[model.AgentRun]
	AgentSessionResponse = model.AgentSession
	AgentSessionsPage    = page.Paginated[model.AgentSession]
	AgentMessagesPage    = page.Paginated[model.AgentMessage]
)

// Live event types sent over SSE.
const (
	EventRunStarted      = "run_started"
	EventTurnStarted     = "turn_started"
	EventLLMStarted      = "llm_started"
	EventLLMSkipped      = "llm_skipped"
	EventTextDelta       = "text_delta"
	EventToolCallStarted = "tool_call_started"
	EventMessage         = "message"
	EventRunFinished     = "run_finished"
)

// StartRunDTO is the POST /agent-run body. No SessionID starts a new
// session. Subject is required when an API key starts a session and
// ignored for snipet users.
type StartRunDTO struct {
	AgentID   string  `json:"agent_id" validate:"required,uuid"`
	SessionID *string `json:"session_id" validate:"omitempty,uuid"`
	Subject   *string `json:"subject" validate:"omitempty,min=1,max=255"`
	Input     string  `json:"input" validate:"required"`
}

// FindSessionsFilterDTO is the GET /agent-session query string.
type FindSessionsFilterDTO struct {
	Take    *int    `form:"take" validate:"omitempty,min=1"`
	Skip    *int    `form:"skip" validate:"omitempty,min=0"`
	AgentID *string `form:"agent_id" validate:"omitempty,uuid"`
	Subject *string `form:"subject" validate:"omitempty,max=255"`
}

func (dto *FindSessionsFilterDTO) ToFilter(userID *string) *filter.Options[model.AgentSession] {
	opts := []filter.Option{
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
		filter.OrderDesc("updated_at"),
	}
	if dto.AgentID != nil {
		opts = append(opts, filter.WhereEq("agent_id", *dto.AgentID))
	}
	if userID != nil {
		opts = append(opts, filter.WhereEq("user_id", *userID))
	} else if dto.Subject != nil {
		opts = append(opts, filter.WhereEq("subject", *dto.Subject))
	}
	return filter.New[model.AgentSession](opts...)
}

// FindRunsFilterDTO is the GET /agent-run query string.
type FindRunsFilterDTO struct {
	Take      *int   `form:"take" validate:"omitempty,min=1"`
	Skip      *int   `form:"skip" validate:"omitempty,min=0"`
	SessionID string `form:"session_id" validate:"required,uuid"`
}

func (dto *FindRunsFilterDTO) ToFilter() *filter.Options[model.AgentRun] {
	return filter.New[model.AgentRun](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
		filter.WhereEq("session_id", dto.SessionID),
		filter.OrderDesc("created_at"),
	)
}

// FindMessagesFilterDTO is the GET /agent-session/{id}/messages query
// string: newest first, paged by Before (a message id).
type FindMessagesFilterDTO struct {
	Take   *int   `form:"take" validate:"omitempty,min=1,max=500"`
	Before *int64 `form:"before" validate:"omitempty,min=1"`
}

func (dto *FindMessagesFilterDTO) ToFilter(sessionID string) *filter.Options[model.AgentMessage] {
	take := 50
	if dto.Take != nil {
		take = *dto.Take
	}
	opts := []filter.Option{
		filter.Take(take),
		filter.WhereEq("session_id", sessionID),
		filter.OrderDesc("id"),
	}
	if dto.Before != nil {
		opts = append(opts, filter.WhereLt("id", *dto.Before))
	}
	return filter.New[model.AgentMessage](opts...)
}

// ToolCallStartedData is the payload of a tool_call_started event.
type ToolCallStartedData struct {
	CallID string  `json:"call_id"`
	Name   string  `json:"name"`
	ToolID *string `json:"tool_id"`
}

// TurnStartedData is the payload of a turn_started event.
type TurnStartedData struct {
	Turn int `json:"turn"`
}
