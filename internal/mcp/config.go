package mcp

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/go-playground/validator/v10"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

var validate = validator.New()

// HTTPConfig is the config of an MCP server reached over HTTP.
type HTTPConfig struct {
	URL     string            `json:"url" validate:"required,http_url"`
	Headers map[string]string `json:"headers,omitempty"`
	// Timeout is in seconds.
	Timeout int `json:"timeout,omitempty" validate:"omitempty,min=1"`
}

// StdioConfig is the config of an MCP server run as a local process.
type StdioConfig struct {
	Command string   `json:"command" validate:"required"`
	Args    []string `json:"args,omitempty"`
	// Timeout is in seconds.
	Timeout int `json:"timeout,omitempty" validate:"omitempty,min=1"`
}

// HTTPRegistryConfig is the default HTTPConfig a registry item ships with.
// HeadersSchema is a JSON Schema (an object of string properties) describing the
// headers the user fills in when installing the server.
type HTTPRegistryConfig struct {
	URL           string        `json:"url" validate:"required,http_url"`
	HeadersSchema jsonx.JSONMap `json:"headers_schema,omitempty"`
	// Timeout is in seconds.
	Timeout int `json:"timeout,omitempty" validate:"omitempty,min=1"`
}

// ParseHTTPConfig decodes and validates the config of an http server.
func ParseHTTPConfig(config jsonx.JSONMap) (HTTPConfig, error) {
	return decodeConfig[HTTPConfig](config)
}

// ParseStdioConfig decodes and validates the config of a stdio server.
func ParseStdioConfig(config jsonx.JSONMap) (StdioConfig, error) {
	return decodeConfig[StdioConfig](config)
}

// ValidateConfig checks that config has the shape transport requires.
func ValidateConfig(transport Transport, config jsonx.JSONMap) error {
	var err error
	switch transport {
	case TransportHTTP:
		_, err = ParseHTTPConfig(config)
	case TransportStdIO:
		_, err = ParseStdioConfig(config)
	default:
		err = fmt.Errorf("unknown transport %q", transport)
	}
	return err
}

// validateRegistryConfig is ValidateConfig for a registry item's default
// config, which for http may carry a HeadersSchema.
func validateRegistryConfig(transport Transport, config jsonx.JSONMap) error {
	if transport != TransportHTTP {
		return ValidateConfig(transport, config)
	}
	cfg, err := decodeConfig[HTTPRegistryConfig](config)
	if err != nil {
		return err
	}
	if cfg.HeadersSchema == nil {
		return nil
	}
	return validateHeadersSchema(cfg.HeadersSchema)
}

// validateHeadersSchema requires a compilable JSON Schema of an object whose
// properties are all strings, since each property becomes one header value.
func validateHeadersSchema(schema jsonx.JSONMap) error {
	if err := jsonschema.Check(schema); err != nil {
		return fmt.Errorf("headers_schema: %w", err)
	}
	if schema["type"] != "object" {
		return fmt.Errorf(`headers_schema: type must be "object"`)
	}
	properties, _ := schema["properties"].(map[string]any)
	for name, raw := range properties {
		property, _ := raw.(map[string]any)
		if property["type"] != "string" {
			return fmt.Errorf(`headers_schema: property %q must be of type "string"`, name)
		}
	}
	return nil
}

// decodeConfig decodes config into T, rejecting unknown fields, and runs
// T's validate tags.
func decodeConfig[T any](config jsonx.JSONMap) (T, error) {
	var out T
	raw, err := json.Marshal(config)
	if err != nil {
		return out, fmt.Errorf("encode config: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&out); err != nil {
		return out, fmt.Errorf("decode config: %w", err)
	}
	if err := validate.Struct(out); err != nil {
		return out, err
	}
	return out, nil
}
