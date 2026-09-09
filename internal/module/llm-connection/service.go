package llmconnection

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
)

// Service owns the llm-connection business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo        repository.ILlmConnectionRepository
	llmRegistry *llm.Registry
}

func NewService(repo repository.ILlmConnectionRepository, llmRegistry *llm.Registry) *Service {
	return &Service{repo: repo, llmRegistry: llmRegistry}
}

func (s *Service) Filter(ctx context.Context, dto FindLlmConnectionsFilterDTO) (*page.Paginated[model.LlmConnection], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.LlmConnection, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto CreateLlmConnectionDTO) (*model.LlmConnection, error) {
	_, err := s.llmRegistry.Connect(ctx, dto.Provider, dto.Config)
	if err != nil {
		return nil, apperr.BadRequest(err.Error())
	}

	entity := &model.LlmConnection{
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
func (s *Service) Update(ctx context.Context, id string, dto UpdateLlmConnectionDTO) error {
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

		_, err := s.llmRegistry.Connect(ctx, provider, config)
		if err != nil {
			return apperr.BadRequest(err.Error())
		}
	}

	updates := &model.LlmConnection{}
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

func (s *Service) ListProviders(ctx context.Context) []llm.Info {
	return s.llmRegistry.List()
}
