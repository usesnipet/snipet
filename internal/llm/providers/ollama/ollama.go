// Package ollama is an llm.Provider driver for an Ollama server
// (https://ollama.com). It needs no credentials; the server URL is an
// optional "base_url" in the connection options' config section.
//
// Model listing and health checks use Ollama's native API; chat generation
// goes through the shared openai_compatible client (see chat.go).
package ollama

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"net/http"

	"resty.dev/v3"

	"github.com/usesnipet/snipet/internal/llm"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

//go:embed schema/config.json
var configSchemaJSON []byte

// ConfigSchema validates the "config" section of a connection options map for
// an OpenAI-compatible provider. Wire it into llm.Info.Schemas.Config.
var ConfigSchema = jsonschema.MustLoad(configSchemaJSON)

// providerKey is this provider's registry key.
const providerKey = "ollama"

var (
	_ llm.Provider      = (*Provider)(nil)
	_ llm.Generator     = (*Provider)(nil)
	_ llm.Streamer      = (*Provider)(nil)
	_ llm.HealthChecker = (*Provider)(nil)
)

// Provider talks to an Ollama server over its HTTP API.
type Provider struct {
	client *resty.Client
}

// New builds a Provider. With no options it targets a local Ollama server.
func New() llm.Provider {
	p := &Provider{client: resty.New()}
	return p
}

// Info implements llm.Provider.
func (p *Provider) Info() llm.Info {
	return llm.Info{
		Key:         providerKey,
		Name:        "Ollama",
		Description: "Local models served by an Ollama server",
		Tags:        []string{"local", "self-hosted", "open-source"},
		Icon:        "https://ollama.com/public/ollama.png",
		Auth:        []llm.Auth{{Type: llm.AuthTypeNone}},
		Schemas:     llm.Schemas{Config: ConfigSchema},
	}
}

// Models implements llm.Provider: it lists the models the server has pulled.
func (p *Provider) Models(ctx context.Context, connectionOptions jsonx.JSONMap) ([]llm.Model, error) {
	connOpts, err := toOllamaConnectionOptions(p.Info(), connectionOptions)
	if err != nil {
		return nil, err
	}

	var out struct {
		Models []struct {
			Name         string         `json:"name"`
			Model        string         `json:"model"`
			Capabilities CapabilityList `json:"capabilities"`
		} `json:"models"`
	}
	if err := p.get(ctx, connOpts, "/api/tags", &out); err != nil {
		return nil, err
	}

	models := make([]llm.Model, 0, len(out.Models))
	for _, m := range out.Models {
		models = append(models, llm.Model{
			Key:          m.Model,
			Name:         m.Name,
			Capabilities: m.Capabilities.ToLLMCapabilities(),
		})
	}
	return models, nil
}

// HealthCheck implements llm.HealthChecker by hitting the server's version
// endpoint.
func (p *Provider) HealthCheck(ctx context.Context, connectionOptions jsonx.JSONMap) error {
	connOpts, err := toOllamaConnectionOptions(p.Info(), connectionOptions)
	if err != nil {
		return err
	}
	return p.get(ctx, connOpts, "/api/version", nil)
}

// get issues a GET against the native Ollama API and decodes a JSON result.
// out may be nil when only the status matters.
func (p *Provider) get(ctx context.Context, connectionOptions ConnectionOptions, path string, out any) error {
	var apiErr ollamaError

	resp, err := p.client.R().
		SetContext(ctx).
		SetResponseForceContentType("application/json").
		SetResult(out).
		SetResultError(&apiErr).
		Get(connectionOptions.Config.BaseURL + path)
	if err != nil {
		return fmt.Errorf("ollama %s: %w", path, transportErr(err))
	}
	if resp.IsStatusFailure() {
		return statusErr(resp.StatusCode(), apiErr.Error)
	}
	return nil
}

type ollamaError struct {
	Error string `json:"error"`
}

// transportErr maps a resty transport error to an llm sentinel. A context
// error passes through unchanged so the Runner treats it as fatal.
func transportErr(err error) error {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	return fmt.Errorf("%v: %w", err, llm.ErrUnavailable)
}

// statusErr maps a >= 400 status (and the server's error message) to an llm
// sentinel.
func statusErr(status int, detail string) error {
	if detail == "" {
		detail = http.StatusText(status)
	}
	switch {
	case status == http.StatusTooManyRequests:
		return fmt.Errorf("ollama: %s: %w", detail, llm.ErrRateLimit)
	case status == http.StatusUnauthorized, status == http.StatusForbidden:
		return fmt.Errorf("ollama: %s: %w", detail, llm.ErrAuth)
	case status == http.StatusNotFound:
		return fmt.Errorf("ollama: %s: %w", detail, llm.ErrModelNotFound)
	case status == http.StatusBadRequest:
		return fmt.Errorf("ollama: %s: %w", detail, llm.ErrBadRequest)
	case status >= 500:
		return fmt.Errorf("ollama: %s: %w", detail, llm.ErrUnavailable)
	default:
		return fmt.Errorf("ollama: unexpected status %d: %s", status, detail)
	}
}
