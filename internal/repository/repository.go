package repository

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/page"
	"gorm.io/gorm"
)

type Repository[T any] struct {
	DB *gorm.DB
}

func (r *Repository[T]) db(ctx context.Context) *gorm.DB {
	return DB(ctx, r.DB)
}

func (r *Repository[T]) Create(ctx context.Context, model *T) error {
	return gorm.G[T](r.db(ctx)).Create(ctx, model)
}

func (r *Repository[T]) Filter(ctx context.Context, filterOptions *filter.Options[T]) (*page.Paginated[T], error) {
	if filterOptions == nil {
		filterOptions = filter.Default[T]()
	}
	countChain, err := filterOptions.ToGorm(
		gorm.G[T](r.db(ctx)),
		filter.WithAllowOrder(false),
		filter.WithAllowPaginate(false),
		filter.WithAllowPreload(false),
	)
	if err != nil {
		return nil, err
	}

	total, err := countChain.Count(ctx, "1 = 1")
	if err != nil {
		return nil, err
	}

	dataChain, err := filterOptions.ToGorm(gorm.G[T](r.db(ctx)))
	if err != nil {
		return nil, err
	}

	data, err := dataChain.Find(ctx)
	return page.NewPaginated(data, total, int64(filterOptions.Skip), int64(filterOptions.Take)), err
}

func (r *Repository[T]) UpdateByID(ctx context.Context, id string, model *T) error {
	affected, err := gorm.G[T](r.db(ctx)).Where("id = ?", id).Updates(ctx, *model)
	if err != nil {
		return err
	}
	if affected == 0 {
		return apperr.NotFound("entity not found")
	}
	return nil
}

func (r *Repository[T]) DeleteByID(ctx context.Context, id string) error {
	affected, err := gorm.G[T](r.db(ctx)).Where("id = ?", id).Delete(ctx)
	if err != nil {
		return err
	}
	if affected == 0 {
		return apperr.NotFound("entity not found")
	}
	return nil
}

func (r *Repository[T]) FindByID(ctx context.Context, id string) (*T, error) {
	paginated, err := r.Filter(ctx, filter.New[T](filter.WhereEq("id", id)))
	if err != nil {
		return nil, err
	}
	if paginated.IsEmpty() {
		return nil, apperr.NotFound("entity not found")
	}
	return paginated.First(), nil
}

func NewRepository[T any](db *gorm.DB) *Repository[T] {
	return &Repository[T]{DB: db}
}
