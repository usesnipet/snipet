package llmprovider

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
)

// Service owns the llm-provider business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo       repository.ILlmProviderRepository
	llmManager *llm.Manager
}

func NewService(repo repository.ILlmProviderRepository, llmManager *llm.Manager) *Service {
	return &Service{repo: repo, llmManager: llmManager}
}

func (s *Service) Filter(ctx context.Context, dto FindLlmProvidersFilterDTO) (*page.Paginated[model.LlmProvider], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.LlmProvider, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto CreateLlmProviderDTO) (*model.LlmProvider, error) {
	if err := s.llmManager.ValidateConfigurationByKey(dto.Provider, dto.Config); err != nil {
		return nil, apperr.BadRequest(err.Error())
	}
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
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}

	if dto.Provider != nil || dto.Config != nil {
		provider := existing.Provider
		config := existing.Config
		if dto.Provider != nil {
			provider = *dto.Provider
		}
		if dto.Config != nil {
			config = dto.Config
		}

		if err := s.llmManager.ValidateConfigurationByKey(provider, config); err != nil {
			return apperr.BadRequest(err.Error())
		}
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
		updates.Enabled = *dto.Enabled
	}
	return s.repo.UpdateByID(ctx, id, updates)
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}

func (s *Service) ListProvidersFromRegistry(ctx context.Context) ([]llm.Info, error) {
	return s.llmManager.ListProviders(ctx)
}
