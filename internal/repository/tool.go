package repository

import (
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type IToolRepository interface {
	IRepository[model.Tool]
	// Add scoped queries here only when generic CRUD is not enough.
}

type ToolRepository struct {
	*Repository[model.Tool]
}

func NewToolRepository(db *gorm.DB) IToolRepository {
	return &ToolRepository{Repository: NewRepository[model.Tool](db)}
}
