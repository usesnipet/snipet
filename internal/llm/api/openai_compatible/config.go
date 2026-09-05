package openaicompatible

import (
	_ "embed"
	"strings"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

//go:embed auth_schema.json
var authSchemaJSON []byte

//go:embed generate_schema.json
var generateSchemaJSON []byte

var (
	DefaultAuthConfigSchema     = llm.MustLoadSchema(authSchemaJSON)
	DefaultGenerateConfigSchema = llm.MustLoadSchema(generateSchemaJSON)
)

// AuthConfig holds the credentials and endpoint needed to reach an
// OpenAI-compatible API.
type AuthConfig struct {
	APIKey   string `json:"api_key"`
	Endpoint string `json:"endpoint"`
}

// NewAuthConfig parses a provider's auth config map into an AuthConfig.
func NewAuthConfig(config jsonx.JSONMap) (AuthConfig, error) {
	cfg, err := jsonx.ParseJSONMap[AuthConfig](config)
	if err != nil {
		return AuthConfig{}, ErrFailedToParseConfig
	}
	return cfg, nil
}

// GenerateConfig holds the per-call generation parameters for an
// OpenAI-compatible API.
type GenerateConfig struct {
	Model       string  `json:"model"`
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
	TopP        float64 `json:"top_p"`
}

// NewGenerateConfig parses and validates a provider's generate config map
// into a GenerateConfig. It fails if the map doesn't match GenerateConfig's
// shape or Model is missing.
func NewGenerateConfig(config jsonx.JSONMap) (GenerateConfig, error) {
	cfg, err := jsonx.ParseJSONMap[GenerateConfig](config)
	if err != nil {
		return GenerateConfig{}, ErrFailedToParseConfig
	}
	return cfg, cfg.validate()
}

func (c GenerateConfig) validate() error {
	if c.Model == "" {
		return ErrModelRequired
	}
	return nil
}

// ResolveBaseURL prefers a runtime endpoint override from auth config,
// otherwise uses defaultBaseURL. Exported so a provider can compute the same
// base URL for its own calls (e.g. a native endpoint outside Chat
// Completions) as Generate/Stream/TestConnection use.
func ResolveBaseURL(defaultBaseURL string, cfg AuthConfig) (string, error) {
	base := cfg.Endpoint
	if base == "" {
		base = defaultBaseURL
	}
	base = strings.TrimRight(base, "/")
	if base == "" {
		return "", ErrBaseURLRequired
	}
	return base, nil
}
