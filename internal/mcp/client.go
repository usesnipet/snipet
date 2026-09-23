package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/usesnipet/snipet/pkg/jsonx"
	"github.com/usesnipet/snipet/version"
)

const defaultTimeout = 30 * time.Second

// RemoteTool is a tool as advertised by an MCP server.
type RemoteTool struct {
	Name        string
	Description string
	InputSchema jsonx.JSONMap
}

// CallResult is the outcome of calling a tool on an MCP server, flattened to text.
type CallResult struct {
	Content string
	IsError bool
}

// IConnector talks to MCP servers. Every call opens its own session and
// closes it before returning.
type IConnector interface {
	ListTools(ctx context.Context, transport Transport, config jsonx.JSONMap) ([]RemoteTool, error)
	CallTool(ctx context.Context, transport Transport, config jsonx.JSONMap, name string, args json.RawMessage) (*CallResult, error)
}

type Connector struct {
	client *mcpsdk.Client
}

func NewConnector() IConnector {
	return &Connector{
		client: mcpsdk.NewClient(&mcpsdk.Implementation{Name: "snipet", Version: version.Version}, nil),
	}
}

func (c *Connector) ListTools(ctx context.Context, transport Transport, config jsonx.JSONMap) ([]RemoteTool, error) {
	var tools []RemoteTool
	err := c.withSession(ctx, transport, config, func(ctx context.Context, session *mcpsdk.ClientSession) error {
		for tool, err := range session.Tools(ctx, nil) {
			if err != nil {
				return fmt.Errorf("list tools: %w", err)
			}
			schema, err := toJSONMap(tool.InputSchema)
			if err != nil {
				return fmt.Errorf("tool %q input schema: %w", tool.Name, err)
			}
			tools = append(tools, RemoteTool{Name: tool.Name, Description: tool.Description, InputSchema: schema})
		}
		return nil
	})
	return tools, err
}

func (c *Connector) CallTool(ctx context.Context, transport Transport, config jsonx.JSONMap, name string, args json.RawMessage) (*CallResult, error) {
	var result *CallResult
	err := c.withSession(ctx, transport, config, func(ctx context.Context, session *mcpsdk.ClientSession) error {
		params := &mcpsdk.CallToolParams{Name: name}
		if len(args) > 0 {
			params.Arguments = args
		}
		res, err := session.CallTool(ctx, params)
		if err != nil {
			return fmt.Errorf("call tool %q: %w", name, err)
		}
		result, err = flattenResult(res)
		return err
	})
	return result, err
}

// withSession connects per the server's config, runs fn and closes the session.
// The config timeout bounds the whole operation, connection included.
func (c *Connector) withSession(
	ctx context.Context,
	transport Transport,
	config jsonx.JSONMap,
	fn func(ctx context.Context, session *mcpsdk.ClientSession) error,
) error {
	build, timeout, err := newTransport(transport, config)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	session, err := c.client.Connect(ctx, build(ctx), nil)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer session.Close()

	return fn(ctx, session)
}

// newTransport parses config and returns a builder for its transport, bound
// to the operation's context so a stdio process dies with it.
func newTransport(transport Transport, config jsonx.JSONMap) (func(context.Context) mcpsdk.Transport, time.Duration, error) {
	switch transport {
	case TransportHTTP:
		cfg, err := ParseHTTPConfig(config)
		if err != nil {
			return nil, 0, err
		}
		return func(context.Context) mcpsdk.Transport {
			return &mcpsdk.StreamableClientTransport{
				Endpoint:             cfg.URL,
				HTTPClient:           &http.Client{Transport: headerRoundTripper{headers: cfg.Headers, base: http.DefaultTransport}},
				DisableStandaloneSSE: true,
			}
		}, timeoutOf(cfg.Timeout), nil
	case TransportStdIO:
		cfg, err := ParseStdioConfig(config)
		if err != nil {
			return nil, 0, err
		}
		return func(ctx context.Context) mcpsdk.Transport {
			return &mcpsdk.CommandTransport{Command: exec.CommandContext(ctx, cfg.Command, cfg.Args...)}
		}, timeoutOf(cfg.Timeout), nil
	}
	return nil, 0, fmt.Errorf("unknown transport %q", transport)
}

func timeoutOf(seconds int) time.Duration {
	if seconds <= 0 {
		return defaultTimeout
	}
	return time.Duration(seconds) * time.Second
}

// headerRoundTripper sets the server's configured headers (e.g. auth tokens) on every request.
type headerRoundTripper struct {
	headers map[string]string
	base    http.RoundTripper
}

func (rt headerRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if len(rt.headers) == 0 {
		return rt.base.RoundTrip(req)
	}
	req = req.Clone(req.Context())
	for key, value := range rt.headers {
		req.Header.Set(key, value)
	}
	return rt.base.RoundTrip(req)
}

// flattenResult joins text content with newlines and JSON-encodes any other
// content (images, resources…). Structured content is used when there is no
// content at all.
func flattenResult(res *mcpsdk.CallToolResult) (*CallResult, error) {
	parts := make([]string, 0, len(res.Content))
	for _, content := range res.Content {
		if text, ok := content.(*mcpsdk.TextContent); ok {
			parts = append(parts, text.Text)
			continue
		}
		raw, err := content.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("encode content: %w", err)
		}
		parts = append(parts, string(raw))
	}
	if len(parts) == 0 && res.StructuredContent != nil {
		raw, err := json.Marshal(res.StructuredContent)
		if err != nil {
			return nil, fmt.Errorf("encode structured content: %w", err)
		}
		parts = append(parts, string(raw))
	}
	return &CallResult{Content: strings.Join(parts, "\n"), IsError: res.IsError}, nil
}

func toJSONMap(value any) (jsonx.JSONMap, error) {
	if value == nil {
		return jsonx.JSONMap{"type": "object"}, nil
	}
	return jsonx.ToJSONMap(value)
}
