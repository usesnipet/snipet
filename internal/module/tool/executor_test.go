package tool_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/mcp"
	mcpmocks "github.com/usesnipet/snipet/internal/mcp/mocks"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/module/tool"
	"github.com/usesnipet/snipet/internal/repository/mocks"
	tooldomain "github.com/usesnipet/snipet/internal/tool"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

var greetSchema = jsonx.JSONMap{
	"type":       "object",
	"required":   []any{"name"},
	"properties": map[string]any{"name": map[string]any{"type": "string"}},
}

type executorDeps struct {
	tools     *mocks.MockIToolRepository
	servers   *mocks.MockIMcpServerRepository
	connector *mcpmocks.MockIConnector
	executor  *tool.Executor
}

func newExecutor(t *testing.T) executorDeps {
	d := executorDeps{
		tools:     mocks.NewMockIToolRepository(t),
		servers:   mocks.NewMockIMcpServerRepository(t),
		connector: mcpmocks.NewMockIConnector(t),
	}
	d.executor = tool.NewExecutor(d.tools, d.servers, d.connector)
	return d
}

func mcpTool() *model.Tool {
	serverID := "server-1"
	return &model.Tool{ID: "tool-1", Name: "greet", InputSchema: greetSchema, Source: tooldomain.SourceMcp, McpServerId: &serverID}
}

func mcpServer() *model.McpServer {
	return &model.McpServer{ID: "server-1", Transport: mcp.TransportStdIO, Config: jsonx.JSONMap{"command": "npx"}}
}

func TestExecuteCallsToolOnItsServer(t *testing.T) {
	t.Parallel()

	d := newExecutor(t)
	args := jsonx.JSONMap{"name": "ana"}
	d.tools.EXPECT().FindByID(mock.Anything, "tool-1").Return(mcpTool(), nil)
	d.servers.EXPECT().FindByID(mock.Anything, "server-1").Return(mcpServer(), nil)
	d.connector.EXPECT().
		CallTool(mock.Anything, mcp.TransportStdIO, mcpServer().Config, "greet", args).
		Return(&mcp.CallResult{Content: "hi ana"}, nil)

	result, err := d.executor.Execute(context.Background(), "tool-1", args)

	require.NoError(t, err)
	assert.Equal(t, &tooldomain.Result{Content: "hi ana"}, result)
}

func TestExecuteReturnsErrorResultForInvalidArguments(t *testing.T) {
	t.Parallel()

	d := newExecutor(t)
	d.tools.EXPECT().FindByID(mock.Anything, "tool-1").Return(mcpTool(), nil)

	result, err := d.executor.Execute(context.Background(), "tool-1", jsonx.JSONMap{})

	require.NoError(t, err)
	assert.True(t, result.IsError)
	assert.Contains(t, result.Content, "invalid arguments")
}

func TestExecuteReturnsErrorResultWhenServerFails(t *testing.T) {
	t.Parallel()

	d := newExecutor(t)
	d.tools.EXPECT().FindByID(mock.Anything, "tool-1").Return(mcpTool(), nil)
	d.servers.EXPECT().FindByID(mock.Anything, "server-1").Return(mcpServer(), nil)
	d.connector.EXPECT().
		CallTool(mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, errors.New("connect: timeout"))

	result, err := d.executor.Execute(context.Background(), "tool-1", jsonx.JSONMap{"name": "ana"})

	require.NoError(t, err)
	assert.Equal(t, &tooldomain.Result{Content: "connect: timeout", IsError: true}, result)
}

func TestExecuteRejectsNonMcpTool(t *testing.T) {
	t.Parallel()

	d := newExecutor(t)
	d.tools.EXPECT().FindByID(mock.Anything, "tool-1").Return(&model.Tool{ID: "tool-1", Source: tooldomain.SourceNative}, nil)

	_, err := d.executor.Execute(context.Background(), "tool-1", nil)

	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 400, appErr.StatusCode)
}

func TestExecuteUnknownToolReturnsNotFound(t *testing.T) {
	t.Parallel()

	d := newExecutor(t)
	d.tools.EXPECT().FindByID(mock.Anything, "missing").Return(nil, apperr.NotFound("entity not found"))

	_, err := d.executor.Execute(context.Background(), "missing", nil)

	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 404, appErr.StatusCode)
}
