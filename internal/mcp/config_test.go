package mcp

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

func TestValidateConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		transport Transport
		config    jsonx.JSONMap
		wantErr   bool
	}{
		{"http ok", TransportHTTP, jsonx.JSONMap{"url": "https://example.com/mcp", "headers": map[string]any{"X-Key": "v"}, "timeout": 30}, false},
		{"http missing url", TransportHTTP, jsonx.JSONMap{"timeout": 30}, true},
		{"http invalid url", TransportHTTP, jsonx.JSONMap{"url": "not a url"}, true},
		{"http non-string header", TransportHTTP, jsonx.JSONMap{"url": "https://example.com", "headers": map[string]any{"X-Key": 1}}, true},
		{"http stdio field", TransportHTTP, jsonx.JSONMap{"url": "https://example.com", "command": "npx"}, true},
		{"stdio ok", TransportStdIO, jsonx.JSONMap{"command": "npx", "args": []any{"-y", "pkg"}}, false},
		{"stdio missing command", TransportStdIO, jsonx.JSONMap{"args": []any{"x"}}, true},
		{"stdio zero timeout", TransportStdIO, jsonx.JSONMap{"command": "npx", "timeout": 0}, false},
		{"stdio negative timeout", TransportStdIO, jsonx.JSONMap{"command": "npx", "timeout": -1}, true},
		{"unknown transport", Transport("sse"), jsonx.JSONMap{"url": "https://example.com"}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateConfig(tt.transport, tt.config)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateRegistryConfigHeadersSchema(t *testing.T) {
	t.Parallel()

	base := func(headers any) jsonx.JSONMap {
		return jsonx.JSONMap{"url": "https://example.com/mcp", "headers_schema": headers}
	}

	require.NoError(t, validateRegistryConfig(TransportHTTP, base(map[string]any{
		"type":       "object",
		"required":   []any{"Authorization"},
		"properties": map[string]any{"Authorization": map[string]any{"type": "string", "format": "password"}},
	})))

	assert.Error(t, validateRegistryConfig(TransportHTTP, base(map[string]any{"type": "string"})))
	assert.Error(t, validateRegistryConfig(TransportHTTP, base(map[string]any{
		"type":       "object",
		"properties": map[string]any{"Retries": map[string]any{"type": "integer"}},
	})))
}

func TestBuiltInRegistryIsValid(t *testing.T) {
	t.Parallel()

	_, err := parseRegistryItems(builtInMCPServers)
	require.NoError(t, err)
}
