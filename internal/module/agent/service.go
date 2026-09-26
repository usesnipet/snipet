package agent

import (
	"context"
	"fmt"
	"path"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
	llmconnection "github.com/usesnipet/snipet/internal/module/llm-connection"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
)

const defaultMaxTurns = 20

// Service owns the agent business logic. It depends on the repository
// interfaces (never the concrete types) so it is mockable in tests.
type Service struct {
	tx          repository.ITxManager
	repo        repository.IAgentRepository
	mcpServers  repository.IMcpServerRepository
	tools       repository.IToolRepository
	connections *llmconnection.Service
}

func NewService(
	tx repository.ITxManager,
	repo repository.IAgentRepository,
	mcpServers repository.IMcpServerRepository,
	tools repository.IToolRepository,
	connections *llmconnection.Service,
) *Service {
	return &Service{tx: tx, repo: repo, mcpServers: mcpServers, tools: tools, connections: connections}
}

func (s *Service) Filter(ctx context.Context, dto FindAgentsFilterDTO) (*page.Paginated[model.Agent], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.Agent, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto CreateAgentDTO) (*model.Agent, error) {
	llms, err := s.toLLMs(ctx, dto.LLMs)
	if err != nil {
		return nil, err
	}
	servers, err := s.toMcpServers(ctx, dto.McpServers)
	if err != nil {
		return nil, err
	}

	entity := &model.Agent{
		Name:         dto.Name,
		Description:  dto.Description,
		SystemPrompt: dto.SystemPrompt,
		MaxTurns:     dto.MaxTurns,
		Enabled:      dto.Enabled == nil || *dto.Enabled,
		LLMs:         llms,
		McpServers:   servers,
	}
	if entity.MaxTurns == 0 {
		entity.MaxTurns = defaultMaxTurns
	}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

// Update merges the set fields into the stored agent; LLMs and McpServers,
// when set, replace the whole list in the same transaction.
func (s *Service) Update(ctx context.Context, id string, dto UpdateAgentDTO) error {
	current, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}

	llms, servers := current.LLMs, current.McpServers
	if dto.LLMs != nil {
		if llms, err = s.toLLMs(ctx, dto.LLMs); err != nil {
			return err
		}
	}
	if dto.McpServers != nil {
		if servers, err = s.toMcpServers(ctx, dto.McpServers); err != nil {
			return err
		}
	}

	if dto.Name != nil {
		current.Name = *dto.Name
	}
	if dto.Description != nil {
		current.Description = *dto.Description
	}
	if dto.SystemPrompt != nil {
		current.SystemPrompt = *dto.SystemPrompt
	}
	if dto.MaxTurns != nil {
		current.MaxTurns = *dto.MaxTurns
	}
	if dto.Enabled != nil {
		current.Enabled = *dto.Enabled
	}

	return s.tx.WithTransaction(ctx, func(ctx context.Context) error {
		if err := s.repo.UpdateByID(ctx, id, current); err != nil {
			return err
		}
		if dto.LLMs == nil && dto.McpServers == nil {
			return nil
		}
		return s.repo.ReplaceRelations(ctx, id, llms, servers)
	})
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}

// Targets turns the agent's LLMs, in order, into runner targets.
func (s *Service) Targets(ctx context.Context, agent *model.Agent) ([]llm.Target, error) {
	dtos := make([]llmconnection.ExecuteLlmTargetDTO, 0, len(agent.LLMs))
	for _, l := range agent.LLMs {
		dtos = append(dtos, llmconnection.ExecuteLlmTargetDTO{
			Model:        l.Model,
			ConnectionID: l.LlmConnectionID,
			ExtraOptions: l.ExtraOptions,
		})
	}
	return s.connections.ResolveTargets(ctx, dtos)
}

// ResolveTools returns the tools the agent may call, named for the LLM, and
// a map from that name to the tool's ID.
func (s *Service) ResolveTools(ctx context.Context, agent *model.Agent) ([]llm.Tool, map[string]string, error) {
	if len(agent.McpServers) == 0 {
		return nil, map[string]string{}, nil
	}
	ids := make([]any, 0, len(agent.McpServers))
	for _, g := range agent.McpServers {
		ids = append(ids, g.McpServerID)
	}
	found, err := s.tools.Filter(ctx, filter.New[model.Tool](
		filter.WhereIn("mcp_server_id", ids...),
		filter.OrderAsc("name"),
		filter.Include("McpServer"),
	))
	if err != nil {
		return nil, nil, err
	}
	tools, index := allowedTools(agent.McpServers, found.Data)
	return tools, index, nil
}

// FindTools is ResolveTools for an agent id, without the name index.
func (s *Service) FindTools(ctx context.Context, id string) ([]llm.Tool, error) {
	agent, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	tools, _, err := s.ResolveTools(ctx, agent)
	return tools, err
}

func (s *Service) toLLMs(ctx context.Context, dtos []AgentLLMDTO) ([]model.AgentLLM, error) {
	llms := make([]model.AgentLLM, 0, len(dtos))
	for i, d := range dtos {
		providerKey, _, ok := llm.SplitModelRef(d.Model)
		if !ok {
			return nil, apperr.BadRequest(fmt.Sprintf("bad model ref %q", d.Model))
		}
		if d.LlmConnectionID != nil {
			conn, err := s.connections.FindByID(ctx, *d.LlmConnectionID)
			if err != nil {
				return nil, err
			}
			if conn.Provider != providerKey {
				return nil, apperr.BadRequest(fmt.Sprintf("connection %q is not a %q connection", conn.ID, providerKey))
			}
		}
		llms = append(llms, model.AgentLLM{
			Order:           i,
			Model:           d.Model,
			LlmConnectionID: d.LlmConnectionID,
			ExtraOptions:    d.ExtraOptions,
		})
	}
	return llms, nil
}

func (s *Service) toMcpServers(ctx context.Context, dtos []AgentMcpServerDTO) ([]model.AgentMcpServer, error) {
	servers := make([]model.AgentMcpServer, 0, len(dtos))
	seen := make(map[string]bool, len(dtos))
	for _, d := range dtos {
		if seen[d.McpServerID] {
			return nil, apperr.BadRequest(fmt.Sprintf("mcp server %q granted twice", d.McpServerID))
		}
		seen[d.McpServerID] = true
		for _, p := range append(append([]string{}, d.Allow...), d.Deny...) {
			if _, err := path.Match(p, ""); err != nil {
				return nil, apperr.BadRequest(fmt.Sprintf("bad pattern %q", p))
			}
		}
		if _, err := s.mcpServers.FindByID(ctx, d.McpServerID); err != nil {
			return nil, err
		}
		servers = append(servers, model.AgentMcpServer{
			McpServerID: d.McpServerID,
			Allow:       nonNil(d.Allow),
			Deny:        nonNil(d.Deny),
		})
	}
	return servers, nil
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
