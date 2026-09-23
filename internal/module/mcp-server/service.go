package mcpserver

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/mcp"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Service owns the mcp-server business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo     repository.IMcpServerRepository
	registry *mcp.Registry
}

func NewService(repo repository.IMcpServerRepository, registry *mcp.Registry) *Service {
	return &Service{repo: repo, registry: registry}
}

func (s *Service) Filter(ctx context.Context, dto FindMcpServersFilterDTO) (*page.Paginated[model.McpServer], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.McpServer, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto CreateMcpServerDTO) (*model.McpServer, error) {
	if err := validateConfig(dto.Transport, dto.Config); err != nil {
		return nil, err
	}
	entity := &model.McpServer{
		Name:      dto.Name,
		Transport: dto.Transport,
		Config:    dto.Config,
	}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

// Update applies only the fields the caller set (non-nil pointers). A field
// left at its zero value is omitted from the SQL SET clause by GORM.
func (s *Service) Update(ctx context.Context, id string, dto UpdateMcpServerDTO) error {
	current, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if dto.Transport != nil || dto.Config != nil {
		transport, config := current.Transport, current.Config
		if dto.Transport != nil {
			transport = *dto.Transport
		}
		if dto.Config != nil {
			config = dto.Config
		}
		if err := validateConfig(transport, config); err != nil {
			return err
		}
	}

	updates := &model.McpServer{}
	if dto.Name != nil {
		updates.Name = *dto.Name
	}
	if dto.Transport != nil {
		updates.Transport = *dto.Transport
	}
	if dto.Config != nil {
		updates.Config = dto.Config
	}
	return s.repo.UpdateByID(ctx, id, updates)
}

// validateConfig rejects a config that doesn't match its transport's shape.
func validateConfig(transport mcp.Transport, config jsonx.JSONMap) error {
	if err := mcp.ValidateConfig(transport, config); err != nil {
		return apperr.BadRequest("invalid config: " + err.Error())
	}
	return nil
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}

func (s *Service) ListRegistry() []mcp.MCPServersRegistryItem {
	return s.registry.List()
}

func (s *Service) GetRegistryItem(key string) (*mcp.MCPServersRegistryItem, error) {
	item := s.registry.Get(key)
	if item == nil {
		return nil, apperr.NotFound("mcp server registry item not found")
	}
	return item, nil
}
