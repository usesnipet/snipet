package mcpserver

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/mcp"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
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
	if _, err := s.repo.FindByID(ctx, id); err != nil {
		return err
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
