package mcp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

type greetInput struct {
	Name string `json:"name" jsonschema:"who to greet"`
}

const stdioServerFlag = "-serve-mcp-stdio"

// TestMain doubles the test binary as a stdio MCP server when started with
// stdioServerFlag, so the stdio transport is tested without external tools.
func TestMain(m *testing.M) {
	if slices.Contains(os.Args[1:], stdioServerFlag) {
		if err := newGreetServer().Run(context.Background(), &mcpsdk.StdioTransport{}); err != nil {
			os.Exit(1)
		}
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func newGreetServer() *mcpsdk.Server {
	server := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "test", Version: "v0"}, nil)
	mcpsdk.AddTool(server, &mcpsdk.Tool{Name: "greet", Description: "Say hi"},
		func(_ context.Context, _ *mcpsdk.CallToolRequest, in greetInput) (*mcpsdk.CallToolResult, any, error) {
			return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "hi " + in.Name}}}, nil, nil
		})
	return server
}

// newTestServer serves an MCP server with a single "greet" tool over
// streamable HTTP, rejecting requests without the expected token.
func newTestServer(t *testing.T, token string) string {
	t.Helper()

	server := newGreetServer()
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return server }, nil)
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(httpServer.Close)
	return httpServer.URL
}

func TestConnectorOverHTTP(t *testing.T) {
	t.Parallel()

	url := newTestServer(t, "secret")
	config := jsonx.JSONMap{"url": url, "headers": map[string]any{"Authorization": "Bearer secret"}, "timeout": 5}
	connector := NewConnector()

	tools, err := connector.ListTools(context.Background(), TransportHTTP, config)
	require.NoError(t, err)
	require.Len(t, tools, 1)
	assert.Equal(t, "greet", tools[0].Name)
	assert.Equal(t, "Say hi", tools[0].Description)
	assert.Contains(t, tools[0].InputSchema["properties"], "name")

	result, err := connector.CallTool(context.Background(), TransportHTTP, config, "greet", jsonx.JSONMap{"name": "ana"})
	require.NoError(t, err)
	assert.Equal(t, &CallResult{Content: "hi ana"}, result)
}

func TestConnectorOverStdio(t *testing.T) {
	t.Parallel()

	config := jsonx.JSONMap{"command": os.Args[0], "args": []any{stdioServerFlag}, "timeout": 10}
	connector := NewConnector()

	tools, err := connector.ListTools(context.Background(), TransportStdIO, config)
	require.NoError(t, err)
	require.Len(t, tools, 1)
	assert.Equal(t, "greet", tools[0].Name)

	result, err := connector.CallTool(context.Background(), TransportStdIO, config, "greet", jsonx.JSONMap{"name": "bia"})
	require.NoError(t, err)
	assert.Equal(t, &CallResult{Content: "hi bia"}, result)
}

func TestConnectorSendsParamHeaders(t *testing.T) {
	t.Parallel()

	server := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "test", Version: "v0"}, nil)
	server.AddTool(&mcpsdk.Tool{
		Name: "list_branches",
		InputSchema: map[string]any{
			"type":       "object",
			"properties": map[string]any{"repo": map[string]any{"type": "string", "x-mcp-header": "repo"}},
			"required":   []any{"repo"},
		},
	}, func(context.Context, *mcpsdk.CallToolRequest) (*mcpsdk.CallToolResult, error) {
		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "main"}}}, nil
	})
	// Stateless servers speak the protocol version that validates Mcp-Param-* headers.
	handler := mcpsdk.NewStreamableHTTPHandler(func(*http.Request) *mcpsdk.Server { return server }, &mcpsdk.StreamableHTTPOptions{Stateless: true})
	httpServer := httptest.NewServer(handler)
	t.Cleanup(httpServer.Close)

	config := jsonx.JSONMap{"url": httpServer.URL, "timeout": 5}
	result, err := NewConnector().CallTool(context.Background(), TransportHTTP, config, "list_branches", jsonx.JSONMap{"repo": "snipet"})
	require.NoError(t, err)
	assert.Equal(t, &CallResult{Content: "main"}, result)
}

func TestConnectorSendsConfiguredHeaders(t *testing.T) {
	t.Parallel()

	url := newTestServer(t, "secret")
	config := jsonx.JSONMap{"url": url, "headers": map[string]any{"Authorization": "Bearer wrong"}, "timeout": 5}

	_, err := NewConnector().ListTools(context.Background(), TransportHTTP, config)
	assert.Error(t, err)
}

func TestConnectorRejectsInvalidConfig(t *testing.T) {
	t.Parallel()

	_, err := NewConnector().ListTools(context.Background(), TransportStdIO, jsonx.JSONMap{"url": "https://example.com"})
	assert.Error(t, err)
}

func TestFlattenResult(t *testing.T) {
	t.Parallel()

	result, err := flattenResult(&mcpsdk.CallToolResult{
		Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "a"}, &mcpsdk.TextContent{Text: "b"}},
		IsError: true,
	})
	require.NoError(t, err)
	assert.Equal(t, &CallResult{Content: "a\nb", IsError: true}, result)

	result, err = flattenResult(&mcpsdk.CallToolResult{StructuredContent: map[string]any{"n": 1}})
	require.NoError(t, err)
	assert.Equal(t, `{"n":1}`, result.Content)
}
