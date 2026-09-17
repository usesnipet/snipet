package repository

import (
	"context"
	"errors"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type ILlmConnectionRepository interface {
	IRepository[model.LlmConnection]

	// FindDefaultByProvider returns the connection marked default for
	// provider, or nil if none is set.
	FindDefaultByProvider(ctx context.Context, provider string) (*model.LlmConnection, error)
}

type LlmConnectionRepository struct {
	*Repository[model.LlmConnection]
}

func NewLlmConnectionRepository(db *gorm.DB) ILlmConnectionRepository {
	return &LlmConnectionRepository{Repository: NewRepository[model.LlmConnection](db)}
}

func (r *LlmConnectionRepository) Create(ctx context.Context, data *model.LlmConnection) error {
	return WithTransaction(ctx, r.db(ctx), func(ctx context.Context) error {
		_, err := gorm.G[model.LlmConnection](r.db(ctx)).
			Where("provider = ?", data.Provider).
			Where("is_default = ?", true).
			First(ctx)
		if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
			data.Default = true
		} else if err != nil {
			return apperr.InternalServerError("error getting default provider")
		} else if data.Default {
			if err := r.clearDefaultByProvider(ctx, data.Provider, ""); err != nil {
				return err
			}
		}

		return r.Repository.Create(ctx, data)
	})
}

func (r *LlmConnectionRepository) UpdateByID(ctx context.Context, id string, data *model.LlmConnection) error {
	return WithTransaction(ctx, r.db(ctx), func(ctx context.Context) error {
		provider := data.Provider
		if provider == "" {
			existing, err := r.Repository.FindByID(ctx, id)
			if err != nil {
				return err
			}
			provider = existing.Provider
		}
		_, err := gorm.G[model.LlmConnection](r.db(ctx)).
			Where("provider = ?", provider).
			Where("is_default = ?", true).
			First(ctx)
		if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
			data.Default = true
		} else if err != nil {
			return apperr.InternalServerError("error getting default provider")
		} else if data.Default {
			if err := r.clearDefaultByProvider(ctx, provider, id); err != nil {
				return err
			}
		}
		return r.Repository.UpdateByID(ctx, id, data)
	})
}

// clearDefaultByProvider unsets is_default on every connection for provider
// except excludeID (pass "" to clear all). A single-column Update, not the
// struct-based Updates — that variant skips zero-value fields, which would
// silently drop a false and leave more than one connection marked default.
func (r *LlmConnectionRepository) clearDefaultByProvider(ctx context.Context, provider, excludeID string) error {
	q := gorm.G[model.LlmConnection](r.db(ctx)).Where("provider = ? AND is_default = ?", provider, true)
	if excludeID != "" {
		q = q.Where("id <> ?", excludeID)
	}
	_, err := q.Update(ctx, "is_default", false)
	return err
}

func (r *LlmConnectionRepository) FindDefaultByProvider(ctx context.Context, provider string) (*model.LlmConnection, error) {
	conn, err := gorm.G[model.LlmConnection](r.db(ctx)).
		Where("provider = ? AND is_default = ?", provider, true).
		First(ctx)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &conn, nil
}
