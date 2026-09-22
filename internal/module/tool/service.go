package tool

import (
	"context"

	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
)

// Service owns the tool business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo repository.IToolRepository
}

func NewService(repo repository.IToolRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Filter(ctx context.Context, dto FindToolsFilterDTO) (*page.Paginated[model.Tool], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.Tool, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}
