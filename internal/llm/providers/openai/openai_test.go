package openai_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/llm/providers/openai"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

func TestNewCompatible_UsesDefaultBaseURL(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/models", r.URL.Path)
		assert.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{"id": "gpt-4o"}, {"id": "gpt-4o-mini"}},
		})
	}))
	defer srv.Close()

	p := openai.NewCompatible(llm.Info{Key: "acme", Name: "Acme"}, srv.URL+"/v1")
	assert.Equal(t, llm.AuthTypeStatic, p.Info().Auth[0].Type)
	assert.NotNil(t, p.Info().Schemas.Config)

	models, err := p.Models(context.Background(), jsonx.JSONMap{
		"auth": jsonx.JSONMap{"api_key": "sk-test"},
	})
	require.NoError(t, err)
	require.Len(t, models, 2)
	assert.Equal(t, "gpt-4o", models[0].Key)
}

func TestGenerate_ConfigBaseURLOverridesDefault(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/chat/completions", r.URL.Path)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message":       map[string]any{"role": "assistant", "content": "ok"},
				"finish_reason": "stop",
			}},
		})
	}))
	defer srv.Close()

	resp, err := openai.New().Generate(context.Background(), llm.GenerateRequest{
		Model:    "gpt-4o",
		Messages: []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: jsonx.JSONMap{
			"config": jsonx.JSONMap{"base_url": srv.URL},
			"auth":   jsonx.JSONMap{"api_key": "sk-test"},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, llm.FinishStop, resp.FinishReason)
}
