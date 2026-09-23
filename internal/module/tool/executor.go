package tool

import (
	"context"
	"fmt"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/mcp"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/internal/tool"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Executor runs a tool by id. Failures the model can act on come back as a
// Result with IsError set; the error return is for internal failures only.
type Executor struct {
	tools     repository.IToolRepository
	servers   repository.IMcpServerRepository
	connector mcp.IConnector
}

func NewExecutor(
	tools repository.IToolRepository,
	servers repository.IMcpServerRepository,
	connector mcp.IConnector,
) *Executor {
	return &Executor{tools: tools, servers: servers, connector: connector}
}

func (e *Executor) Execute(ctx context.Context, toolID string, args jsonx.JSONMap) (*tool.Result, error) {
	t, err := e.tools.FindByID(ctx, toolID)
	if err != nil {
		return nil, err
	}
	if t.Source != tool.SourceMcp || t.McpServerId == nil {
		return nil, apperr.BadRequest(fmt.Sprintf("unsupported tool source %q", t.Source))
	}

	if _, err := jsonschema.Validate(t.InputSchema, args); err != nil {
		return &tool.Result{Content: "invalid arguments: " + err.Error(), IsError: true}, nil
	}

	server, err := e.servers.FindByID(ctx, *t.McpServerId)
	if err != nil {
		return nil, err
	}
	res, err := e.connector.CallTool(ctx, server.Transport, server.Config, t.Name, args)
	if err != nil {
		return &tool.Result{Content: err.Error(), IsError: true}, nil
	}
	return &tool.Result{Content: res.Content, IsError: res.IsError}, nil
}
