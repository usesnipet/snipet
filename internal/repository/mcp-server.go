package repository

import (
	"context"
	"time"

	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

const maxSyncErrorLength = 255

type IMcpServerRepository interface {
	IRepository[model.McpServer]
	// UpdateSyncStatus records the outcome of a tool sync; an empty errMsg
	// clears a previous error.
	UpdateSyncStatus(ctx context.Context, id string, at time.Time, errMsg string) error
}

type McpServerRepository struct {
	*Repository[model.McpServer]
}

func NewMcpServerRepository(db *gorm.DB) IMcpServerRepository {
	return &McpServerRepository{Repository: NewRepository[model.McpServer](db)}
}

func (r *McpServerRepository) UpdateSyncStatus(ctx context.Context, id string, at time.Time, errMsg string) error {
	if runes := []rune(errMsg); len(runes) > maxSyncErrorLength {
		errMsg = string(runes[:maxSyncErrorLength])
	}
	return r.db(ctx).Model(&model.McpServer{}).Where("id = ?", id).Updates(map[string]any{
		"last_synced_at":    at,
		"last_synced_error": errMsg,
	}).Error
}
