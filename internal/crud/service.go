package crud

import (
	"context"

	"github.com/usesnipet/snipet/app/internal/filter"
	"github.com/usesnipet/snipet/app/internal/logger"
	"github.com/usesnipet/snipet/app/internal/model"
)

type Service[T model.Model] struct {
	Repository *Repository[T]
	Logger     *logger.Logger
}

func (s *Service[T]) Create(ctx context.Context, model *T) error {
	s.Logger.Verbosef("Create: %+v", model)
	return s.Repository.Create(ctx, model)
}

func (s *Service[T]) FindByID(ctx context.Context, id string) (T, error) {
	s.Logger.Verbosef("FindByID: %s", id)
	return s.Repository.FindByID(ctx, id)
}

func (s *Service[T]) FindBy(ctx context.Context, options *filter.Options[T]) ([]T, error) {
	s.Logger.Verbosef("FindBy: %+v", options)
	return s.Repository.FindBy(ctx, options)
}

func (s *Service[T]) UpdateByID(ctx context.Context, id string, model *T) error {
	s.Logger.Verbosef("UpdateByID: %s, %+v", id, model)
	return s.Repository.UpdateByID(ctx, id, model)
}

func (s *Service[T]) DeleteByID(ctx context.Context, id string) error {
	s.Logger.Verbosef("DeleteByID: %s", id)
	return s.Repository.DeleteByID(ctx, id)
}

func NewService[T model.Model](repository *Repository[T], logger *logger.Logger) *Service[T] {
	return &Service[T]{Repository: repository, Logger: logger}
}
