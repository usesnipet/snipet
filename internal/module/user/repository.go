package user

import (
	"context"
	"errors"
	"strings"

	"github.com/usesnipet/snipet/app/internal/infra/database"
	"github.com/usesnipet/snipet/app/internal/model"
	"gorm.io/gorm"
)

type Repository struct {
	*database.Repository[model.User]
}

func (r *Repository) FindByAccount(ctx context.Context, account string) (model.User, error) {
	account = strings.ToLower(strings.TrimSpace(account))
	user, err := gorm.G[model.User](r.DB).
		Where("email = ? OR nickname = ?", account, account).
		First(ctx)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, ErrUserNotFound
	}
	return user, err
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		Repository: database.NewRepository[model.User](db),
	}
}
