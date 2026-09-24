package repository

import (
	"context"
	"errors"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type IAgentRepository interface {
	IRepository[model.Agent]
	// ReplaceRelations makes llms and servers the exact LLM list and MCP
	// server grants of an agent.
	ReplaceRelations(ctx context.Context, agentID string, llms []model.AgentLLM, servers []model.AgentMcpServer) error
}

type AgentRepository struct {
	*Repository[model.Agent]
}

func NewAgentRepository(db *gorm.DB) IAgentRepository {
	return &AgentRepository{Repository: NewRepository[model.Agent](db)}
}

// Create inserts the agent and its relations in one transaction.
func (r *AgentRepository) Create(ctx context.Context, agent *model.Agent) error {
	return WithTransaction(ctx, r.DB, func(ctx context.Context) error {
		if err := r.db(ctx).Omit(clause.Associations).Create(agent).Error; err != nil {
			return err
		}
		return r.ReplaceRelations(ctx, agent.ID, agent.LLMs, agent.McpServers)
	})
}

// FindByID loads the agent with its LLMs (by order) and MCP server grants.
func (r *AgentRepository) FindByID(ctx context.Context, id string) (*model.Agent, error) {
	var agent model.Agent
	err := r.db(ctx).
		Preload("LLMs", func(db *gorm.DB) *gorm.DB { return db.Order(`"order" ASC`) }).
		Preload("McpServers.McpServer").
		Where("id = ?", id).
		Take(&agent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apperr.NotFound("entity not found")
	}
	if err != nil {
		return nil, err
	}
	return &agent, nil
}

// UpdateByID writes every scalar column, zero values included, so callers
// pass the full merged agent (Enabled=false must reach the DB).
func (r *AgentRepository) UpdateByID(ctx context.Context, id string, agent *model.Agent) error {
	res := r.db(ctx).Model(&model.Agent{}).Where("id = ?", id).
		Select("name", "description", "system_prompt", "max_turns", "enabled", "updated_at").
		Updates(agent)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("entity not found")
	}
	return nil
}

func (r *AgentRepository) ReplaceRelations(ctx context.Context, agentID string, llms []model.AgentLLM, servers []model.AgentMcpServer) error {
	return WithTransaction(ctx, r.DB, func(ctx context.Context) error {
		db := r.db(ctx)
		if err := db.Where("agent_id = ?", agentID).Delete(&model.AgentLLM{}).Error; err != nil {
			return err
		}
		if err := db.Where("agent_id = ?", agentID).Delete(&model.AgentMcpServer{}).Error; err != nil {
			return err
		}
		for i := range llms {
			llms[i].ID = ""
			llms[i].AgentID = agentID
		}
		for i := range servers {
			servers[i].AgentID = agentID
		}
		if len(llms) > 0 {
			if err := db.Omit(clause.Associations).Create(&llms).Error; err != nil {
				return err
			}
		}
		if len(servers) > 0 {
			if err := db.Omit(clause.Associations).Create(&servers).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
