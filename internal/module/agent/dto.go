package agent

import (
	"strings"

	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// AgentResponse and AgentsPage exist so swagger annotations in this package
// can name a plain type — swag can't parse a generic instantiation like
// page.Paginated[model.Agent] inline.
type AgentResponse = model.Agent

type AgentsPage = page.Paginated[model.Agent]

type AgentToolResponse = llm.Tool

// AgentLLMDTO is one entry of the agent's LLM list; its position in the list
// is its order.
type AgentLLMDTO struct {
	Model           string        `json:"model" validate:"required,max=255"`
	LlmConnectionID *string       `json:"llm_connection_id" validate:"omitempty,uuid"`
	ExtraOptions    jsonx.JSONMap `json:"extra_options" validate:"omitempty" swaggertype:"object"`
}

// AgentMcpServerDTO grants the agent an MCP server's tools, narrowed by glob
// patterns on the tool name.
type AgentMcpServerDTO struct {
	McpServerID string   `json:"mcp_server_id" validate:"required,uuid"`
	Allow       []string `json:"allow" validate:"omitempty,dive,required,max=255"`
	Deny        []string `json:"deny" validate:"omitempty,dive,required,max=255"`
}

// CreateAgentDTO is the POST body. MaxTurns 0 means the default (20);
// Enabled nil means true.
type CreateAgentDTO struct {
	Name         string              `json:"name" validate:"required,max=255"`
	Description  string              `json:"description" validate:"omitempty"`
	SystemPrompt string              `json:"system_prompt" validate:"omitempty"`
	MaxTurns     int                 `json:"max_turns" validate:"omitempty,min=1,max=500"`
	Enabled      *bool               `json:"enabled" validate:"omitempty"`
	LLMs         []AgentLLMDTO       `json:"llms" validate:"required,min=1,dive"`
	McpServers   []AgentMcpServerDTO `json:"mcp_servers" validate:"omitempty,dive"`
}

// UpdateAgentDTO is the PUT body — nil means "leave unchanged". LLMs and
// McpServers, when set, replace the whole list ("mcp_servers": [] clears it).
type UpdateAgentDTO struct {
	Name         *string             `json:"name" validate:"omitempty,max=255"`
	Description  *string             `json:"description" validate:"omitempty"`
	SystemPrompt *string             `json:"system_prompt" validate:"omitempty"`
	MaxTurns     *int                `json:"max_turns" validate:"omitempty,min=1,max=500"`
	Enabled      *bool               `json:"enabled" validate:"omitempty"`
	LLMs         []AgentLLMDTO       `json:"llms" validate:"omitempty,min=1,dive"`
	McpServers   []AgentMcpServerDTO `json:"mcp_servers" validate:"omitempty,dive"`
}

// FindAgentsFilterDTO is the list query string; ToFilter turns it into the
// repository's filter options.
type FindAgentsFilterDTO struct {
	Take   *int    `form:"take" validate:"omitempty,min=1"`
	Skip   *int    `form:"skip" validate:"omitempty,min=0"`
	Search *string `form:"search" validate:"omitempty,max=255"`
}

// likeEscaper escapes LIKE wildcards so a search term matches literally.
var likeEscaper = strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`)

func (dto *FindAgentsFilterDTO) ToFilter() *filter.Options[model.Agent] {
	opts := []filter.Option{
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
		filter.OrderAsc("name"),
		filter.Include("LLMs", "McpServers"),
	}
	if dto.Search != nil && strings.TrimSpace(*dto.Search) != "" {
		opts = append(opts, filter.WhereILike("name", "%"+likeEscaper.Replace(strings.TrimSpace(*dto.Search))+"%"))
	}
	return filter.New[model.Agent](opts...)
}
