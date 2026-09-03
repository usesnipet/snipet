package llmprovider

import (
	"context"

	"github.com/usesnipet/go-template/internal/model"
	"github.com/usesnipet/go-template/internal/page"
	"github.com/usesnipet/go-template/internal/repository"
)

// Service owns the llm-provider business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo repository.ILlmProviderRepository
}

func NewService(repo repository.ILlmProviderRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Filter(ctx context.Context, dto FindLlmProvidersFilterDTO) (*page.Paginated[model.LlmProvider], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.LlmProvider, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto CreateLlmProviderDTO) (*model.LlmProvider, error) {
	entity := &model.LlmProvider{
		Name:     dto.Name,
		Provider: dto.Provider,
		Config:   dto.Config,
		Enabled:  dto.Enabled,
	}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

// Update applies only the fields the caller set (non-nil pointers). A field
// left at its zero value is omitted from the SQL SET clause by GORM.
func (s *Service) Update(ctx context.Context, id string, dto UpdateLlmProviderDTO) error {
	if _, err := s.repo.FindByID(ctx, id); err != nil {
		return err
	}

	updates := &model.LlmProvider{}
	if dto.Name != nil {
		updates.Name = *dto.Name
	}
	if dto.Provider != nil {
		updates.Provider = *dto.Provider
	}
	if dto.Config != nil {
		updates.Config = dto.Config
	}
	if dto.Enabled != nil {
		updates.Enabled = dto.Enabled
	}
	return s.repo.UpdateByID(ctx, id, updates)
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}
