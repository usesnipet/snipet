package jsonschema_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

func TestLoad_ParsesJSONIntoMap(t *testing.T) {
	t.Parallel()
	m, err := jsonschema.Load([]byte(`{"type":"object"}`))

	require.NoError(t, err)
	assert.Equal(t, "object", m["type"])
}

func TestLoad_InvalidJSON(t *testing.T) {
	t.Parallel()
	_, err := jsonschema.Load([]byte(`not json`))

	assert.ErrorIs(t, err, jsonschema.ErrInvalidJSON)
}

func TestMustLoad_PanicsOnInvalidJSON(t *testing.T) {
	t.Parallel()
	assert.Panics(t, func() { jsonschema.MustLoad([]byte(`not json`)) })
}

func TestValidate_NilSchemaIsNoop(t *testing.T) {
	t.Parallel()
	out, err := jsonschema.Validate(nil, jsonx.JSONMap{"a": 1})

	require.NoError(t, err)
	assert.Equal(t, jsonx.JSONMap{"a": 1}, out)
}

func TestValidate_FillsMissingFieldFromDefault(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type": "object",
		"properties": jsonx.JSONMap{
			"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"},
		},
	}

	out, err := jsonschema.Validate(schema, nil)

	require.NoError(t, err)
	assert.Equal(t, "http://localhost:11434", out["base_url"])
}

func TestValidate_DoesNotOverrideProvidedValue(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"}},
	}

	out, err := jsonschema.Validate(schema, jsonx.JSONMap{"base_url": "https://api.example.com"})

	require.NoError(t, err)
	assert.Equal(t, "https://api.example.com", out["base_url"])
}

func TestValidate_RequiredFieldWithNoDefaultStillFails(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"api_key": jsonx.JSONMap{"type": "string"}},
		"required":   []any{"api_key"},
	}

	_, err := jsonschema.Validate(schema, nil)

	assert.Error(t, err)
}

func TestValidate_RequiredFieldWithDefaultPasses(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"}},
		"required":   []any{"base_url"},
	}

	out, err := jsonschema.Validate(schema, nil)

	require.NoError(t, err)
	assert.Equal(t, "http://localhost:11434", out["base_url"])
}

func TestValidate_RejectsAdditionalProperties(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type":                 "object",
		"properties":           jsonx.JSONMap{"api_key": jsonx.JSONMap{"type": "string"}},
		"additionalProperties": false,
	}

	_, err := jsonschema.Validate(schema, jsonx.JSONMap{"wrong": "field"})

	assert.Error(t, err)
}

func TestParseAndValidate_DecodesNormalizedResultIntoStruct(t *testing.T) {
	t.Parallel()
	type Config struct {
		BaseURL string `json:"base_url"`
	}
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"}},
	}

	cfg, err := jsonschema.ParseAndValidate[Config](schema, nil)

	require.NoError(t, err)
	assert.Equal(t, "http://localhost:11434", cfg.BaseURL)
}

func TestParseAndValidate_PropagatesValidationError(t *testing.T) {
	t.Parallel()
	type Config struct {
		APIKey string `json:"api_key"`
	}
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"api_key": jsonx.JSONMap{"type": "string"}},
		"required":   []any{"api_key"},
	}

	_, err := jsonschema.ParseAndValidate[Config](schema, nil)

	assert.Error(t, err)
}
