// Package mcp holds the built-in catalog of known MCP servers (Registry).
// The registry does not limit which MCP servers the system can use — a
// user can add any MCP server via the mcp-server module — it only surfaces
// known ones for easy setup.
package mcp

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"github.com/usesnipet/snipet/pkg/collections/set"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

//go:embed built-in-mcp-servers.json
var builtInMCPServers []byte

// MCPServersRegistryItem is one entry in the built-in catalog.
type MCPServersRegistryItem struct {
	Key         string    `json:"key" validate:"required"`
	Name        string    `json:"name" validate:"required"`
	Description string    `json:"description" validate:"required"`
	Icon        string    `json:"icon" validate:"required"`
	Tags        []string  `json:"tags" validate:"required"`
	Transport   Transport `json:"transport" validate:"required,oneof=http stdio"`

	// Config is the default config for the server: a StdioRegistryConfig or
	// an HTTPRegistryConfig, per Transport.
	Config jsonx.JSONMap `json:"config" validate:"required"`
}

// Registry is the read-only catalog of known MCP servers, keyed by Key.
type Registry struct {
	items map[string]MCPServersRegistryItem
}

// NewRegistry builds a Registry preloaded with the embedded built-in
// catalog. It panics if that catalog is malformed, since it ships with the
// binary.
func NewRegistry() *Registry {
	items, err := parseRegistryItems(builtInMCPServers)
	if err != nil {
		panic(fmt.Sprintf("mcp: invalid built-in registry: %v", err))
	}
	r := &Registry{items: make(map[string]MCPServersRegistryItem, len(items))}
	for _, item := range items {
		r.items[item.Key] = item
	}
	return r
}

// parseRegistryItems decodes and validates a JSON array of registry items,
// rejecting duplicate keys.
func parseRegistryItems(data []byte) ([]MCPServersRegistryItem, error) {
	var items []MCPServersRegistryItem
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	seen := set.New[string]()
	for _, item := range items {
		if err := validate.Struct(item); err != nil {
			return nil, fmt.Errorf("item %q: %w", item.Key, err)
		}
		if err := validateRegistryConfig(item.Transport, item.Config); err != nil {
			return nil, fmt.Errorf("item %q: config: %w", item.Key, err)
		}
		if seen.Contains(item.Key) {
			return nil, fmt.Errorf("duplicate key %q", item.Key)
		}
		seen.Add(item.Key)
	}
	return items, nil
}

// List returns every registry item, ordered by key.
func (r *Registry) List() []MCPServersRegistryItem {
	out := make([]MCPServersRegistryItem, 0, len(r.items))
	for _, item := range r.items {
		out = append(out, item)
	}
	slices.SortFunc(out, func(a, b MCPServersRegistryItem) int {
		return strings.Compare(a.Key, b.Key)
	})
	return out
}

// Get returns the item registered under key, or nil if none is.
func (r *Registry) Get(key string) *MCPServersRegistryItem {
	item, ok := r.items[key]
	if !ok {
		return nil
	}
	return &item
}
