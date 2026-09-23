package mcpserver_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/mcp"
	mcpmocks "github.com/usesnipet/snipet/internal/mcp/mocks"
	"github.com/usesnipet/snipet/internal/model"
	mcpserver "github.com/usesnipet/snipet/internal/module/mcp-server"
	"github.com/usesnipet/snipet/internal/repository/mocks"
	"github.com/usesnipet/snipet/internal/tool"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

func TestSyncServerReplacesToolsAndClearsError(t *testing.T) {
	t.Parallel()

	servers := mocks.NewMockIMcpServerRepository(t)
	tools := mocks.NewMockIToolRepository(t)
	connector := mcpmocks.NewMockIConnector(t)

	server := &model.McpServer{ID: "id-1", Name: "Memory", Transport: mcp.TransportStdIO, Config: jsonx.JSONMap{"command": "npx"}}
	servers.EXPECT().FindByID(mock.Anything, "id-1").Return(server, nil)
	connector.EXPECT().ListTools(mock.Anything, mcp.TransportStdIO, server.Config).Return([]mcp.RemoteTool{
		{Name: "read_graph", Description: "Read the graph", InputSchema: jsonx.JSONMap{"type": "object"}},
	}, nil)
	tools.EXPECT().
		ReplaceServerTools(mock.Anything, "id-1", []model.Tool{{
			Name:        "read_graph",
			Description: "Read the graph",
			InputSchema: jsonx.JSONMap{"type": "object"},
			Source:      tool.SourceMcp,
		}}).
		Return(nil)
	servers.EXPECT().UpdateSyncStatus(mock.Anything, "id-1", mock.Anything, "").Return(nil)

	svc := mcpserver.NewSyncService(servers, tools, connector)
	require.NoError(t, svc.SyncServer(context.Background(), "id-1"))
}

func TestSyncServerKeepsToolsWhenServerIsUnreachable(t *testing.T) {
	t.Parallel()

	servers := mocks.NewMockIMcpServerRepository(t)
	tools := mocks.NewMockIToolRepository(t)
	connector := mcpmocks.NewMockIConnector(t)

	server := &model.McpServer{ID: "id-1", Name: "Memory", Transport: mcp.TransportStdIO, Config: jsonx.JSONMap{"command": "npx"}}
	servers.EXPECT().FindByID(mock.Anything, "id-1").Return(server, nil)
	connector.EXPECT().ListTools(mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("connect: exec: not found"))
	servers.EXPECT().UpdateSyncStatus(mock.Anything, "id-1", mock.Anything, "connect: exec: not found").Return(nil)

	svc := mcpserver.NewSyncService(servers, tools, connector)
	err := svc.SyncServer(context.Background(), "id-1")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
	tools.AssertNotCalled(t, "ReplaceServerTools", mock.Anything, mock.Anything, mock.Anything)
}
