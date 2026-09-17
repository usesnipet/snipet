package llmconnection

import (
	"context"
	"errors"
	"fmt"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Service owns the llm-connection business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo        repository.ILlmConnectionRepository
	llmRegistry *llm.Registry
	runner      *llm.Runner
}

func NewService(repo repository.ILlmConnectionRepository, llmRegistry *llm.Registry, runner *llm.Runner) *Service {
	return &Service{repo: repo, llmRegistry: llmRegistry, runner: runner}
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
		Default:  dto.Default,
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

	provider := existing.Provider
	if dto.Provider != nil || dto.Config != nil {
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
	if dto.Default != nil {
		updates.Default = *dto.Default
	}
	if err := s.repo.UpdateByID(ctx, id, updates); err != nil {
		return err
	}

	return nil
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}

func (s *Service) ListProviders(ctx context.Context) []llm.Info {
	return s.llmRegistry.List()
}

// ListProviderModels returns providerKey's model catalog, sourcing connection
// options from connectionID's stored connection when given, else providerKey's
// default connection (see resolveConnection). Connect validates those options
// (schema + health check) before the catalog call, same as a Generate/Stream
// target would.
func (s *Service) ListProviderModels(ctx context.Context, providerKey string, connectionID *string) ([]llm.Model, error) {
	conn, err := s.resolveConnection(ctx, providerKey, connectionID)
	if err != nil {
		return nil, err
	}

	var connectionOptions jsonx.JSONMap
	if conn != nil {
		connectionOptions = conn.Config
	}

	if _, err := s.llmRegistry.Connect(ctx, providerKey, connectionOptions); err != nil {
		return nil, translateLlmError(err)
	}

	models, err := s.llmRegistry.Models(ctx, providerKey, connectionOptions)
	if err != nil {
		return nil, translateLlmError(err)
	}
	return models, nil
}

// Generate runs dto's targets to completion and returns the first successful
// response (see llm.Runner.Generate for failover semantics).
func (s *Service) Generate(ctx context.Context, dto ExecuteLlmDTO) (llm.Response, error) {
	targets, err := s.resolveTargets(ctx, dto.Targets)
	if err != nil {
		return llm.Response{}, err
	}
	resp, err := s.runner.Generate(ctx, targets, dto.Messages, nil)
	return resp, translateLlmError(err)
}

// Stream runs dto's targets and returns the iterator of the first target that
// starts streaming successfully (see llm.Runner.Stream for failover
// semantics). The caller must Close the returned iterator.
func (s *Service) Stream(ctx context.Context, dto ExecuteLlmDTO) (llm.StreamIterator, error) {
	targets, err := s.resolveTargets(ctx, dto.Targets)
	if err != nil {
		return nil, err
	}
	it, err := s.runner.Stream(ctx, targets, dto.Messages, nil)
	return it, translateLlmError(err)
}

// resolveTargets turns each ExecuteLlmTargetDTO into a llm.Target, filling in
// ConnectionOptions from a stored LlmConnection when the caller didn't supply
// them inline. A provider left without a matching connection is passed
// through with no connection options — Registry.Connect rejects it downstream
// if the provider actually requires one.
func (s *Service) resolveTargets(ctx context.Context, dtos []ExecuteLlmTargetDTO) ([]llm.Target, error) {
	targets := make([]llm.Target, 0, len(dtos))
	for _, t := range dtos {
		providerKey, _, ok := llm.SplitModelRef(t.Model)
		if !ok {
			return nil, apperr.BadRequest(fmt.Sprintf("bad model ref %q", t.Model))
		}

		connectionOptions := t.ConnectionOptions
		if connectionOptions == nil {
			conn, err := s.resolveConnection(ctx, providerKey, t.ConnectionID)
			if err != nil {
				return nil, err
			}
			if conn != nil {
				connectionOptions = conn.Config
			}
		}

		targets = append(targets, llm.Target{
			Model:             t.Model,
			ExtraOptions:      t.ExtraOptions,
			ConnectionOptions: connectionOptions,
		})
	}
	return targets, nil
}

// resolveConnection looks up the stored connection to use for providerKey:
// connectionID when the caller named one (validated against providerKey), else
// the provider's default connection, else its oldest connection. Returns nil
// (not an error) if none exists.
func (s *Service) resolveConnection(ctx context.Context, providerKey string, connectionID *string) (*model.LlmConnection, error) {
	if connectionID != nil {
		conn, err := s.repo.FindByID(ctx, *connectionID)
		if err != nil {
			return nil, err
		}
		if conn.Provider != providerKey {
			return nil, apperr.BadRequest(fmt.Sprintf("connection %q is not a %q connection", *connectionID, providerKey))
		}
		return conn, nil
	}

	return s.repo.FindDefaultByProvider(ctx, providerKey)
}

// translateLlmError maps the internal/llm error vocabulary onto apperr status
// codes; anything else passes through unchanged.
func translateLlmError(err error) error {
	if err == nil {
		return nil
	}
	var failover *llm.FailoverError
	switch {
	case errors.As(err, &failover):
		return apperr.NetworkError(err.Error())
	case errors.Is(err, llm.ErrModelNotFound), errors.Is(err, llm.ErrProviderNotFound):
		return apperr.NotFound(err.Error())
	case errors.Is(err, llm.ErrAuth):
		return apperr.Unauthorized(err.Error())
	case errors.Is(err, llm.ErrBadRequest), errors.Is(err, llm.ErrInvalidOptions), errors.Is(err, llm.ErrContextTooLong):
		return apperr.BadRequest(err.Error())
	default:
		return err
	}
}
