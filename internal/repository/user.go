package repository

import (
	"context"
	"errors"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type IUserRepository interface {
	IRepository[model.User]

	// FindByUsername looks up a user by its unique login handle.
	FindByUsername(ctx context.Context, username string) (*model.User, error)
	// CountAll returns the total number of users.
	CountAll(ctx context.Context) (int64, error)
	// CountByRole returns the number of users holding the given role.
	CountByRole(ctx context.Context, role model.Role) (int64, error)
}

type UserRepository struct {
	*Repository[model.User]
}

func NewUserRepository(db *gorm.DB) IUserRepository {
	return &UserRepository{Repository: NewRepository[model.User](db)}
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	user, err := gorm.G[model.User](DB(ctx, r.DB)).Where("username = ?", username).First(ctx)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) CountAll(ctx context.Context) (int64, error) {
	return gorm.G[model.User](DB(ctx, r.DB)).Count(ctx, "*")
}

func (r *UserRepository) CountByRole(ctx context.Context, role model.Role) (int64, error) {
	return gorm.G[model.User](DB(ctx, r.DB)).Where("role = ?", role).Count(ctx, "*")
}
