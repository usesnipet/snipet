package model

import (
	"time"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Agent is the persistence shape of the agent domain: an LLM loop with a
// system prompt, an ordered list of LLMs and a set of granted MCP servers.
// Keep the gorm tags in sync with migrations/ — schema is generated from this
// struct by Atlas (see docs/backend/migrations.md), never hand-written.
type Agent struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	Name string `gorm:"type:varchar(255);not null;uniqueIndex" json:"name"`

	Description string `gorm:"type:text;not null;default:''" json:"description"`

	SystemPrompt string `gorm:"type:text;not null;default:''" json:"system_prompt"`

	MaxTurns int `gorm:"type:integer;not null;default:20" json:"max_turns"`

	Enabled bool `gorm:"type:boolean;not null;default:true" json:"enabled"`

	LLMs       []AgentLLM       `gorm:"foreignKey:AgentID;constraint:OnDelete:CASCADE" json:"llms"`
	McpServers []AgentMcpServer `gorm:"foreignKey:AgentID;constraint:OnDelete:CASCADE" json:"mcp_servers"`

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (Agent) TableName() string {
	return "agents"
}

// AgentLLM is one LLM an agent may use. The runner tries them by ascending
// Order, failing over to the next one.
type AgentLLM struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	AgentID string `gorm:"type:uuid;not null;uniqueIndex:idx_agent_llms_agent_order" json:"agent_id"`

	Order int `gorm:"column:order;type:integer;not null;uniqueIndex:idx_agent_llms_agent_order" json:"order"`

	// Model is a "provider-key/model" reference.
	Model string `gorm:"type:varchar(255);not null" json:"model"`

	// LlmConnectionID nil means the provider's default connection.
	LlmConnectionID *string        `gorm:"type:uuid;index" json:"llm_connection_id"`
	LlmConnection   *LlmConnection `gorm:"foreignKey:LlmConnectionID;references:ID;constraint:OnDelete:SET NULL" json:"-"`

	ExtraOptions jsonx.JSONMap `gorm:"type:jsonb;not null" json:"extra_options"`
}

func (AgentLLM) TableName() string {
	return "agent_llms"
}

// AgentMcpServer grants an agent the tools of one MCP server, narrowed by
// glob patterns on the tool name. Empty Allow means every tool; Deny wins.
type AgentMcpServer struct {
	AgentID string `gorm:"type:uuid;primaryKey" json:"agent_id"`

	McpServerID string     `gorm:"type:uuid;primaryKey" json:"mcp_server_id"`
	McpServer   *McpServer `gorm:"foreignKey:McpServerID;references:ID;constraint:OnDelete:CASCADE" json:"mcp_server,omitempty"`

	Allow []string `gorm:"type:jsonb;not null;serializer:json" json:"allow"`
	Deny  []string `gorm:"type:jsonb;not null;serializer:json" json:"deny"`
}

func (AgentMcpServer) TableName() string {
	return "agent_mcp_servers"
}
