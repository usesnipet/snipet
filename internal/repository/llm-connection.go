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
		existing, err := r.Repository.FindByID(ctx, id)
		if err != nil {
			return err
		}

		provider := existing.Provider
		if data.Provider != "" {
			provider = data.Provider
		}

		_, err = gorm.G[model.LlmConnection](r.db(ctx)).
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

		if err := r.Repository.UpdateByID(ctx, id, data); err != nil {
			return err
		}

		// The row just left provider's default slot for a different provider —
		// promote another of that provider's connections, if any remain.
		if provider != existing.Provider && existing.Default {
			return r.promoteOldestByProvider(ctx, existing.Provider)
		}
		return nil
	})
}

// DeleteByID removes the connection, then — if it was provider's default —
// promotes another of provider's connections so the invariant (every
// provider with a connection has exactly one default) still holds.
func (r *LlmConnectionRepository) DeleteByID(ctx context.Context, id string) error {
	return WithTransaction(ctx, r.db(ctx), func(ctx context.Context) error {
		existing, err := r.Repository.FindByID(ctx, id)
		if err != nil {
			return err
		}

		if err := r.Repository.DeleteByID(ctx, id); err != nil {
			return err
		}

		if !existing.Default {
			return nil
		}
		return r.promoteOldestByProvider(ctx, existing.Provider)
	})
}

// promoteOldestByProvider marks provider's oldest connection as default. A
// no-op if provider has no connections left.
func (r *LlmConnectionRepository) promoteOldestByProvider(ctx context.Context, provider string) error {
	oldest, err := gorm.G[model.LlmConnection](r.db(ctx)).
		Where("provider = ?", provider).
		Order("created_at ASC").
		First(ctx)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	_, err = gorm.G[model.LlmConnection](r.db(ctx)).
		Where("id = ?", oldest.ID).
		Update(ctx, "is_default", true)
	return err
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
