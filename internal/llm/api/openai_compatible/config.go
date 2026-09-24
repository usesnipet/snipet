package openaicompatible

import (
	_ "embed"
	"fmt"
	"strings"

	"github.com/usesnipet/snipet/internal/llm"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

//go:embed schema/config.json
var configSchemaJSON []byte

//go:embed schema/auth.json
var authSchemaJSON []byte

// ConfigSchema validates the "config" section of a connection options map for
// an OpenAI-compatible provider. Wire it into llm.Info.Schemas.Config.
var ConfigSchema = jsonschema.MustLoad(configSchemaJSON)

// AuthSchema validates the "auth" section for providers that require a bearer
// key. Wire it into an llm.Auth{Type: AuthTypeStatic, Data: AuthSchema}.
// Providers that need no key (e.g. a local Ollama) omit it and declare
// AuthTypeNone instead.
var AuthSchema = jsonschema.MustLoad(authSchemaJSON)

// Config is the typed view of an OpenAI-compatible provider's connection
// options. BaseURL and Organization/Headers come from the config section;
// APIKey comes from the auth section.
type Config struct {
	BaseURL      string            `json:"base_url"`
	Organization string            `json:"organization"`
	Headers      map[string]string `json:"headers"`

	APIKey string `json:"-"`
}

// configFromOptions reads the typed Config from connection options: the
// config section for BaseURL/Organization/Headers, the auth section for the
// API key.
func configFromOptions(connectionOptions jsonx.JSONMap) (Config, error) {
	cfg, err := jsonx.ParseJSONMap[Config](llm.ConfigSection(connectionOptions))
	if err != nil {
		return Config{}, fmt.Errorf("config section: %w", err)
	}
	cfg.BaseURL = strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if cfg.BaseURL == "" {
		return Config{}, fmt.Errorf("config section: base_url is required")
	}

	if auth := llm.AuthSection(connectionOptions); auth != nil {
		if key, ok := auth["api_key"].(string); ok {
			cfg.APIKey = key
		}
	}
	return cfg, nil
}
