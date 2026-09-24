package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/usesnipet/snipet/internal/llm"
)

// AgentSession is a conversation with one agent. Exactly one of UserID
// (a snipet user) or Subject (an API key acting for someone in the caller's
// system) is set.
// Keep the gorm tags in sync with migrations/ — schema is generated from this
// struct by Atlas (see docs/backend/migrations.md), never hand-written.
type AgentSession struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	AgentID string `gorm:"type:uuid;not null;index:idx_agent_sessions_agent_subject" json:"agent_id"`
	Agent   *Agent `gorm:"foreignKey:AgentID;references:ID;constraint:OnDelete:CASCADE" json:"-"`

	UserID *string `gorm:"type:uuid;index" json:"user_id"`
	User   *User   `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE" json:"-"`

	Subject *string `gorm:"type:varchar(255);index:idx_agent_sessions_agent_subject" json:"subject"`

	Title string `gorm:"type:varchar(255);not null;default:''" json:"title"`

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (AgentSession) TableName() string {
	return "agent_sessions"
}

type AgentRunStatus string

const (
	AgentRunRunning   AgentRunStatus = "running"
	AgentRunCompleted AgentRunStatus = "completed"
	AgentRunFailed    AgentRunStatus = "failed"
	AgentRunCancelled AgentRunStatus = "cancelled"
	AgentRunMaxTurns  AgentRunStatus = "max_turns"
)

// AgentRun is one user message and the loop that answers it. Its content
// lives in AgentMessage; the run only holds the loop's state.
type AgentRun struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	SessionID string        `gorm:"type:uuid;not null;index" json:"session_id"`
	Session   *AgentSession `gorm:"foreignKey:SessionID;references:ID;constraint:OnDelete:CASCADE" json:"-"`

	Status AgentRunStatus `gorm:"type:varchar(32);not null;index" json:"status"`

	Error string `gorm:"type:text;not null;default:''" json:"error"`

	Turns int `gorm:"type:integer;not null;default:0" json:"turns"`

	InputTokens  int `gorm:"type:integer;not null;default:0" json:"input_tokens"`
	OutputTokens int `gorm:"type:integer;not null;default:0" json:"output_tokens"`

	StartedAt  time.Time  `gorm:"not null;default:now()" json:"started_at"`
	FinishedAt *time.Time `gorm:"type:timestamptz" json:"finished_at"`
	CreatedAt  time.Time  `gorm:"not null;default:now()" json:"created_at"`
}

func (AgentRun) TableName() string {
	return "agent_runs"
}

// AgentMessage is one llm.Message of a session. ID is a sequence: it orders
// the conversation and doubles as the SSE event id.
type AgentMessage struct {
	ID int64 `gorm:"primaryKey;autoIncrement;index:idx_agent_messages_session_id,priority:2" json:"id"`

	SessionID string        `gorm:"type:uuid;not null;index:idx_agent_messages_session_id,priority:1" json:"session_id"`
	Session   *AgentSession `gorm:"foreignKey:SessionID;references:ID;constraint:OnDelete:CASCADE" json:"-"`

	RunID string    `gorm:"type:uuid;not null;index" json:"run_id"`
	Run   *AgentRun `gorm:"foreignKey:RunID;references:ID;constraint:OnDelete:CASCADE" json:"-"`

	Role llm.Role `gorm:"type:varchar(32);not null" json:"role"`

	Parts MessageParts `gorm:"type:jsonb;not null" json:"parts"`

	// Model, InputTokens and OutputTokens are set on assistant messages.
	Model        *string `gorm:"type:varchar(255)" json:"model,omitempty"`
	InputTokens  *int    `gorm:"type:integer" json:"input_tokens,omitempty"`
	OutputTokens *int    `gorm:"type:integer" json:"output_tokens,omitempty"`

	// ToolID and DurationMs are set on tool messages.
	ToolID     *string `gorm:"type:uuid;index" json:"tool_id,omitempty"`
	Tool       *Tool   `gorm:"foreignKey:ToolID;references:ID;constraint:OnDelete:SET NULL" json:"-"`
	DurationMs *int64  `gorm:"type:bigint" json:"duration_ms,omitempty"`

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
}

func (AgentMessage) TableName() string {
	return "agent_messages"
}

// Message converts the row back to the llm.Message it was saved from.
func (m AgentMessage) Message() llm.Message {
	return llm.Message{Role: m.Role, Parts: m.Parts}
}

// MessageParts stores llm.Message parts as a jsonb array, decoding each part
// by its "type" field.
type MessageParts []llm.Part

func (p MessageParts) Value() (driver.Value, error) {
	if p == nil {
		return []byte("[]"), nil
	}
	return json.Marshal([]llm.Part(p))
}

func (p *MessageParts) Scan(value any) error {
	b, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("expected []byte got %T", value)
	}
	return p.UnmarshalJSON(b)
}

func (p *MessageParts) UnmarshalJSON(b []byte) error {
	var m llm.Message
	if err := json.Unmarshal(fmt.Appendf(nil, `{"parts":%s}`, b), &m); err != nil {
		return err
	}
	*p = m.Parts
	return nil
}
