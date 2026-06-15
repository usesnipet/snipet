package crud

import (
	"context"
	"errors"

	"github.com/usesnipet/go-template/internal/filter"
	"github.com/usesnipet/go-template/internal/logger"
	"github.com/usesnipet/go-template/internal/model"
	"gorm.io/gorm"
)

type Repository[T model.Model] struct {
	DB     *gorm.DB
	Logger *logger.Logger
}

func (r *Repository[T]) Create(ctx context.Context, model *T) error {
	return gorm.G[T](r.DB).Create(ctx, model)
}

func (r *Repository[T]) FindByID(ctx context.Context, id string) (T, error) {
	return gorm.G[T](r.DB).Where("id = ?", id).First(ctx)
}

func (r *Repository[T]) FindBy(ctx context.Context, options *filter.Options[T]) ([]T, error) {
	query := options.ToGorm(gorm.G[T](r.DB))
	return query.Find(ctx)
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

func NewRepository[T model.Model](db *gorm.DB, logger *logger.Logger) *Repository[T] {
	return &Repository[T]{
		DB:     db,
		Logger: logger,
	}
}
