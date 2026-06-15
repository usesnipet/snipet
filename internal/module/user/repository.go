package user

import (
	"github.com/usesnipet/go-template/internal/crud"
	"github.com/usesnipet/go-template/internal/logger"
	"github.com/usesnipet/go-template/internal/model"
	"gorm.io/gorm"
)

type UserRepository struct {
	*crud.Repository[model.User]
}

func NewUserRepository(db *gorm.DB, logger *logger.Logger) *UserRepository {
	return &UserRepository{
		Repository: crud.NewRepository[model.User](db, logger),
	}
}
