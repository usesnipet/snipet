package user

import (
	"github.com/usesnipet/snipet/app/internal/crud"
	"github.com/usesnipet/snipet/app/internal/logger"
	"github.com/usesnipet/snipet/app/internal/model"
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
