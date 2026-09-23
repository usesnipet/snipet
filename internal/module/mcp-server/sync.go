package mcpserver

import (
	"context"
	"fmt"
	"time"

	"github.com/usesnipet/snipet/internal/mcp"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/internal/tool"
)

// SyncService refreshes the tools table from what each MCP server advertises.
type SyncService struct {
	servers   repository.IMcpServerRepository
	tools     repository.IToolRepository
	connector mcp.IConnector
}

func NewSyncService(
	servers repository.IMcpServerRepository,
	tools repository.IToolRepository,
	connector mcp.IConnector,
) *SyncService {
	return &SyncService{servers: servers, tools: tools, connector: connector}
}

// SyncServer replaces a server's tools with the ones it lists now. When the
// server can't be reached the previous tools are kept and the error is
// recorded on the server.
func (s *SyncService) SyncServer(ctx context.Context, id string) error {
	server, err := s.servers.FindByID(ctx, id)
	if err != nil {
		return err
	}

	remote, err := s.connector.ListTools(ctx, server.Transport, server.Config)
	if err != nil {
		if statusErr := s.servers.UpdateSyncStatus(ctx, id, time.Now(), err.Error()); statusErr != nil {
			return statusErr
		}
		return fmt.Errorf("sync mcp server %q: %w", server.Name, err)
	}

	tools := make([]model.Tool, 0, len(remote))
	for _, t := range remote {
		tools = append(tools, model.Tool{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: t.InputSchema,
			Source:      tool.SourceMcp,
		})
	}
	if err := s.tools.ReplaceServerTools(ctx, id, tools); err != nil {
		return err
	}
	return s.servers.UpdateSyncStatus(ctx, id, time.Now(), "")
}
