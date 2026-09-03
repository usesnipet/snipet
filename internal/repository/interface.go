package repository

import (
	"context"

	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/page"
)

type IFilterableRepository[T any] interface {
	Filter(ctx context.Context, filter *filter.Options[T]) (*page.Paginated[T], error)
}

type IFindableRepository[T any] interface {
	FindByID(ctx context.Context, id string) (*T, error)
}

type ICreatableRepository[T any] interface {
	Create(ctx context.Context, model *T) error
}

type IUpdatableRepository[T any] interface {
	UpdateByID(ctx context.Context, id string, model *T) error
}

type IDeletableRepository[T any] interface {
	DeleteByID(ctx context.Context, id string) error
}

type IRepository[T any] interface {
	IFilterableRepository[T]
	IFindableRepository[T]
	ICreatableRepository[T]
	IUpdatableRepository[T]
	IDeletableRepository[T]
}

type ITxManager interface {
	WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
