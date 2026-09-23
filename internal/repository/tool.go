package repository

import (
	"context"
	"time"

	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type IToolRepository interface {
	IRepository[model.Tool]
	// ReplaceServerTools makes tools the exact tool set of an MCP server:
	// matching by name, it updates existing ones, creates new ones and
	// deletes those no longer listed.
	ReplaceServerTools(ctx context.Context, serverID string, tools []model.Tool) error
}

type ToolRepository struct {
	*Repository[model.Tool]
}

func NewToolRepository(db *gorm.DB) IToolRepository {
	return &ToolRepository{Repository: NewRepository[model.Tool](db)}
}

func (r *ToolRepository) ReplaceServerTools(ctx context.Context, serverID string, tools []model.Tool) error {
	return WithTransaction(ctx, r.DB, func(ctx context.Context) error {
		existing, err := gorm.G[model.Tool](r.db(ctx)).Where("mcp_server_id = ?", serverID).Find(ctx)
		if err != nil {
			return err
		}
		byName := make(map[string]model.Tool, len(existing))
		for _, tool := range existing {
			byName[tool.Name] = tool
		}

		for _, tool := range tools {
			current, ok := byName[tool.Name]
			delete(byName, tool.Name)
			if !ok {
				tool.McpServerId = &serverID
				if err := gorm.G[model.Tool](r.db(ctx)).Create(ctx, &tool); err != nil {
					return err
				}
				continue
			}
			err := r.db(ctx).Model(&model.Tool{}).Where("id = ?", current.ID).Updates(map[string]any{
				"description":  tool.Description,
				"input_schema": tool.InputSchema,
				"updated_at":   time.Now(),
			}).Error
			if err != nil {
				return err
			}
		}

		for _, stale := range byName {
			if _, err := gorm.G[model.Tool](r.db(ctx)).Where("id = ?", stale.ID).Delete(ctx); err != nil {
				return err
			}
		}
		return nil
	})
}
