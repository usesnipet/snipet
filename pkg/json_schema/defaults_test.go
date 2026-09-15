package jsonschema_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

func TestApplyDefaults_FillsMissingTopLevelField(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type": "object",
		"properties": jsonx.JSONMap{
			"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"},
			"timeout":  jsonx.JSONMap{"type": "integer", "default": 30},
		},
	}

	out := jsonschema.ApplyDefaults(schema, nil)

	assert.Equal(t, "http://localhost:11434", out["base_url"])
	assert.Equal(t, 30, out["timeout"])
}

func TestApplyDefaults_DoesNotOverrideProvidedValue(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"}},
	}

	out := jsonschema.ApplyDefaults(schema, jsonx.JSONMap{"base_url": "https://api.example.com"})

	assert.Equal(t, "https://api.example.com", out["base_url"])
}

func TestApplyDefaults_RecursesIntoNestedObjects(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type": "object",
		"properties": jsonx.JSONMap{
			"retry": jsonx.JSONMap{
				"type": "object",
				"properties": jsonx.JSONMap{
					"max_attempts": jsonx.JSONMap{"type": "integer", "default": 3},
				},
			},
		},
	}

	out := jsonschema.ApplyDefaults(schema, jsonx.JSONMap{"retry": jsonx.JSONMap{}})

	retry, ok := out["retry"].(jsonx.JSONMap)
	require.True(t, ok)
	assert.Equal(t, 3, retry["max_attempts"])
}

func TestApplyDefaults_RecursesIntoArrayItems(t *testing.T) {
	t.Parallel()
	listSchema := jsonx.JSONMap{
		"type": "array",
		"items": jsonx.JSONMap{
			"type":       "object",
			"properties": jsonx.JSONMap{"enabled": jsonx.JSONMap{"type": "boolean", "default": true}},
		},
	}
	schema := jsonx.JSONMap{"type": "object", "properties": jsonx.JSONMap{"list": listSchema}}

	items := jsonschema.ApplyDefaults(schema, jsonx.JSONMap{
		"list": jsonx.JSONArray{jsonx.JSONMap{}},
	})
	list, ok := items["list"].(jsonx.JSONArray)
	require.True(t, ok)
	require.Len(t, list, 1)
	entry, ok := list[0].(jsonx.JSONMap)
	require.True(t, ok)
	assert.Equal(t, true, entry["enabled"])
}

func TestApplyDefaults_NilSchemaIsNoop(t *testing.T) {
	t.Parallel()
	out := jsonschema.ApplyDefaults(nil, jsonx.JSONMap{"a": 1})
	assert.Equal(t, jsonx.JSONMap{"a": 1}, out)
}

func TestApplyDefaults_NilDataReturnsEmptyMapWhenNoDefaults(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{"type": "object", "properties": jsonx.JSONMap{"x": jsonx.JSONMap{"type": "string"}}}

	out := jsonschema.ApplyDefaults(schema, nil)

	assert.Equal(t, jsonx.JSONMap{}, out)
}

func TestNormalize_AppliesDefaultsThenValidates(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type": "object",
		"properties": jsonx.JSONMap{
			"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"},
		},
		"required": []any{"base_url"},
	}

	out, err := jsonschema.Normalize(schema, nil)

	require.NoError(t, err)
	assert.Equal(t, "http://localhost:11434", out["base_url"])
}

func TestNormalize_StillFailsWhenRequiredFieldHasNoDefault(t *testing.T) {
	t.Parallel()
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"api_key": jsonx.JSONMap{"type": "string"}},
		"required":   []any{"api_key"},
	}

	_, err := jsonschema.Normalize(schema, nil)

	assert.Error(t, err)
}

func TestNormalizeAndParse_DecodesIntoTypedStruct(t *testing.T) {
	t.Parallel()
	type Config struct {
		BaseURL string `json:"base_url"`
	}
	schema := jsonx.JSONMap{
		"type":       "object",
		"properties": jsonx.JSONMap{"base_url": jsonx.JSONMap{"type": "string", "default": "http://localhost:11434"}},
	}

	cfg, err := jsonschema.NormalizeAndParse[Config](schema, nil)

	require.NoError(t, err)
	assert.Equal(t, "http://localhost:11434", cfg.BaseURL)
}
