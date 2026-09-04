package repository

import (
	"context"
	"time"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type IRefreshTokenRepository interface {
	Create(ctx context.Context, token *model.RefreshToken) error
	FindByHash(ctx context.Context, hash string) (*model.RefreshToken, error)
	RevokeByID(ctx context.Context, id string) error
	// RevokeAllByUserID revokes every not-yet-revoked token for a user —
	// used on password change so a stolen refresh token doesn't survive it.
	RevokeAllByUserID(ctx context.Context, userID string) error
}

type RefreshTokenRepository struct {
	*Repository[model.RefreshToken]
}

func NewRefreshTokenRepository(db *gorm.DB) IRefreshTokenRepository {
	return &RefreshTokenRepository{
		Repository: NewRepository[model.RefreshToken](db),
	}
}

func (r *RefreshTokenRepository) FindByHash(ctx context.Context, hash string) (*model.RefreshToken, error) {
	token, err := gorm.G[model.RefreshToken](r.db(ctx)).
		Where("hash = ?", hash).
		First(ctx)
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *RefreshTokenRepository) RevokeByID(ctx context.Context, id string) error {
	now := time.Now()
	affected, err := gorm.G[model.RefreshToken](r.db(ctx)).
		Where("id = ?", id).
		Update(ctx, "revoked_at", now)
	if err != nil {
		return err
	}
	if affected == 0 {
		return apperr.NotFound("refresh token not found")
	}
	return nil
}

func (r *RefreshTokenRepository) RevokeAllByUserID(ctx context.Context, userID string) error {
	_, err := gorm.G[model.RefreshToken](r.db(ctx)).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update(ctx, "revoked_at", time.Now())
	return err
}
