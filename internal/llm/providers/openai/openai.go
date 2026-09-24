// Package openai is an llm.Provider driver for the OpenAI API. NewCompatible
// reuses it for any other service that speaks the same API (Groq, Together,
// OpenRouter, ...): only the identity and default endpoint change.
package openai

import (
	"context"
	_ "embed"
	"maps"
	"strings"

	"github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

//go:embed schema/config.json
var configSchemaJSON []byte

// ConfigSchema validates the "config" section; base_url is optional and falls
// back to the provider's default endpoint.
var ConfigSchema = jsonschema.MustLoad(configSchemaJSON)

// DefaultBaseURL is the OpenAI API endpoint.
const DefaultBaseURL = "https://api.openai.com/v1"

var (
	_ llm.Provider      = (*Provider)(nil)
	_ llm.Generator     = (*Provider)(nil)
	_ llm.Streamer      = (*Provider)(nil)
	_ llm.HealthChecker = (*Provider)(nil)
)

// Provider talks to an OpenAI-compatible API.
type Provider struct {
	info    llm.Info
	baseURL string
}

// New builds the OpenAI provider.
func New() *Provider {
	return NewCompatible(llm.Info{
		Key:         "openai",
		Name:        "OpenAI",
		Description: "GPT models served by the OpenAI API",
		Icon:        "https://openai.com/favicon.ico",
		Tags:        []string{"cloud"},
	}, DefaultBaseURL)
}

// NewCompatible builds a provider for an OpenAI-compatible service at baseURL.
// info.Auth defaults to a required bearer api_key and info.Schemas.Config to
// ConfigSchema.
func NewCompatible(info llm.Info, baseURL string) *Provider {
	if info.Auth == nil {
		info.Auth = []llm.Auth{{Type: llm.AuthTypeStatic, Data: openaicompatible.AuthSchema}}
	}
	if info.Schemas.Config == nil {
		info.Schemas.Config = ConfigSchema
	}
	return &Provider{info: info, baseURL: baseURL}
}

// Info implements llm.Provider.
func (p *Provider) Info() llm.Info { return p.info }

// Models implements llm.Provider.
func (p *Provider) Models(ctx context.Context, connectionOptions jsonx.JSONMap) ([]llm.Model, error) {
	return openaicompatible.Models(ctx, p.withBaseURL(connectionOptions))
}

// HealthCheck implements llm.HealthChecker by listing models, which checks
// both reachability and the API key.
func (p *Provider) HealthCheck(ctx context.Context, connectionOptions jsonx.JSONMap) error {
	_, err := p.Models(ctx, connectionOptions)
	return err
}

// Generate implements llm.Generator.
func (p *Provider) Generate(ctx context.Context, req llm.GenerateRequest) (llm.Response, error) {
	req.ConnectionOptions = p.withBaseURL(req.ConnectionOptions)
	return openaicompatible.Generate(ctx, req)
}

// Stream implements llm.Streamer.
func (p *Provider) Stream(ctx context.Context, req llm.GenerateRequest) (llm.StreamIterator, error) {
	req.ConnectionOptions = p.withBaseURL(req.ConnectionOptions)
	return openaicompatible.Stream(ctx, req)
}

// withBaseURL returns a copy of connectionOptions whose config.base_url falls
// back to the provider's default endpoint.
func (p *Provider) withBaseURL(connectionOptions jsonx.JSONMap) jsonx.JSONMap {
	config := jsonx.JSONMap{}
	maps.Copy(config, llm.ConfigSection(connectionOptions))
	if s, _ := config["base_url"].(string); strings.TrimSpace(s) == "" {
		config["base_url"] = p.baseURL
	}
	out := jsonx.JSONMap{"config": config}
	if auth := llm.AuthSection(connectionOptions); auth != nil {
		out["auth"] = auth
	}
	return out
}
