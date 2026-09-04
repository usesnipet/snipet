package repository

import (
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type ILlmConnectionRepository interface {
	IRepository[model.LlmConnection]
	// Add scoped queries here only when generic CRUD is not enough.
}

type LlmConnectionRepository struct {
	*Repository[model.LlmConnection]
}

func NewLlmConnectionRepository(db *gorm.DB) ILlmConnectionRepository {
	return &LlmConnectionRepository{Repository: NewRepository[model.LlmConnection](db)}
}
