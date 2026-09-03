package repository

import (
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type ILlmProviderRepository interface {
	IRepository[model.LlmProvider]
	// Add scoped queries here only when generic CRUD is not enough.
}

type LlmProviderRepository struct {
	*Repository[model.LlmProvider]
}

func NewLlmProviderRepository(db *gorm.DB) ILlmProviderRepository {
	return &LlmProviderRepository{Repository: NewRepository[model.LlmProvider](db)}
}
