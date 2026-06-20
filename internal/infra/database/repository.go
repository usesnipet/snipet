package database

import (
	"context"
	"errors"

	"github.com/usesnipet/snipet/app/internal/filter"
	"gorm.io/gorm"
)

type Repository[T any] struct {
	DB *gorm.DB
}

func (r *Repository[T]) Create(ctx context.Context, organization *T) error {
	return gorm.G[T](r.DB).Create(ctx, organization)
}

func (r *Repository[T]) FindByID(ctx context.Context, id string) (T, error) {
	org, err := gorm.G[T](r.DB).Where("id = ?", id).First(ctx)
	return org, err
}

func (r *Repository[T]) FindBy(ctx context.Context, filter *filter.Options[T]) (*Paginated[T], error) {
	total, err := gorm.G[T](r.DB).Count(ctx, "1 = 1")
	if err != nil {
		return nil, err
	}
	chain := filter.ToGorm(gorm.G[T](r.DB))
	orgs, err := chain.Find(ctx)
	return NewPaginated(orgs, total, filter.Skip, filter.Take), err
}

func (r *Repository[T]) UpdateByID(ctx context.Context, id string, model *T) error {
	affected, err := gorm.G[T](r.DB).Where("id = ?", id).Updates(ctx, *model)
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("model not found")
	}
	return nil
}

func (r *Repository[T]) DeleteByID(ctx context.Context, id string) error {
	affected, err := gorm.G[T](r.DB).Where("id = ?", id).Delete(ctx)
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("model not found")
	}
	return nil
}

func NewRepository[T any](db *gorm.DB) *Repository[T] {
	return &Repository[T]{DB: db}
}
