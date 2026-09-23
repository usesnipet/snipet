package tool

import (
	"context"

	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/internal/tool"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Service owns the tool business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo     repository.IToolRepository
	executor *Executor
}

func NewService(repo repository.IToolRepository, executor *Executor) *Service {
	return &Service{repo: repo, executor: executor}
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

func (s *Service) Execute(ctx context.Context, id string, args jsonx.JSONMap) (*tool.Result, error) {
	return s.executor.Execute(ctx, id, args)
}
