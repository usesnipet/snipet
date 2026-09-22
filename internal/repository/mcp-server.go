package repository

import (
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type IMcpServerRepository interface {
	IRepository[model.McpServer]
	// Add scoped queries here only when generic CRUD is not enough.
}

type McpServerRepository struct {
	*Repository[model.McpServer]
}

func NewMcpServerRepository(db *gorm.DB) IMcpServerRepository {
	return &McpServerRepository{Repository: NewRepository[model.McpServer](db)}
}
