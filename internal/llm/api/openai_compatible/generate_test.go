package openaicompatible_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

func connOpts(baseURL, apiKey string) jsonx.JSONMap {
	m := jsonx.JSONMap{"config": jsonx.JSONMap{"base_url": baseURL}}
	if apiKey != "" {
		m["auth"] = jsonx.JSONMap{"api_key": apiKey}
	}
	return m
}

func TestSchemasEmbed(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "object", openaicompatible.ConfigSchema["type"])
	assert.Equal(t, "object", openaicompatible.AuthSchema["type"])
}

func TestGenerate_TextAndUsage(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/chat/completions", r.URL.Path)
		assert.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))

		var body map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, "gpt-4o", body["model"])
		assert.Equal(t, false, body["stream"])
		assert.Equal(t, float64(0.7), body["temperature"]) // from ExtraOptions

		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message":       map[string]any{"role": "assistant", "content": "hi back"},
				"finish_reason": "stop",
			}},
			"usage": map[string]any{"prompt_tokens": 12, "completion_tokens": 5},
		})
	}))
	defer srv.Close()

	resp, err := openaicompatible.Generate(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ExtraOptions:      jsonx.JSONMap{"temperature": 0.7},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})

	require.NoError(t, err)
	require.Len(t, resp.Message.Parts, 1)
	text, ok := resp.Message.Parts[0].(llm.TextPart)
	require.True(t, ok)
	assert.Equal(t, "hi back", text.Text)
	assert.Equal(t, llm.FinishStop, resp.FinishReason)
	assert.Equal(t, 12, resp.Usage.InputTokens)
	assert.Equal(t, 5, resp.Usage.OutputTokens)
}

func TestGenerate_ToolCalls(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message": map[string]any{
					"role": "assistant",
					"tool_calls": []map[string]any{{
						"id":       "call_1",
						"type":     "function",
						"function": map[string]any{"name": "search", "arguments": `{"q":"go"}`},
					}},
				},
				"finish_reason": "tool_calls",
			}},
		})
	}))
	defer srv.Close()

	resp, err := openaicompatible.Generate(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "search go")},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})

	require.NoError(t, err)
	assert.Equal(t, llm.FinishToolCall, resp.FinishReason)
	require.Len(t, resp.Message.Parts, 1)
	call, ok := resp.Message.Parts[0].(llm.ToolCallPart)
	require.True(t, ok)
	assert.Equal(t, "call_1", call.ID)
	assert.Equal(t, "search", call.Name)
	assert.JSONEq(t, `{"q":"go"}`, string(call.Arguments))
}

func TestGenerate_NoAPIKeyOmitsAuthHeader(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Empty(t, r.Header.Get("Authorization"))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message":       map[string]any{"role": "assistant", "content": "ok"},
				"finish_reason": "stop",
			}},
		})
	}))
	defer srv.Close()

	_, err := openaicompatible.Generate(context.Background(), llm.GenerateRequest{
		Model:             "llama3.2",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: connOpts(srv.URL, ""),
	})

	require.NoError(t, err)
}

func TestGenerate_MissingBaseURLIsBadRequest(t *testing.T) {
	t.Parallel()

	_, err := openaicompatible.Generate(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: jsonx.JSONMap{},
	})

	assert.ErrorIs(t, err, llm.ErrBadRequest)
}

func TestGenerate_ErrorMapping(t *testing.T) {
	t.Parallel()
	cases := []struct {
		status int
		want   error
	}{
		{http.StatusTooManyRequests, llm.ErrRateLimit},
		{http.StatusUnauthorized, llm.ErrAuth},
		{http.StatusNotFound, llm.ErrModelNotFound},
		{http.StatusBadRequest, llm.ErrBadRequest},
		{http.StatusInternalServerError, llm.ErrUnavailable},
	}
	for _, tc := range cases {
		t.Run(http.StatusText(tc.status), func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error": map[string]any{"message": "boom", "type": "x"},
				})
			}))
			defer srv.Close()

			_, err := openaicompatible.Generate(context.Background(), llm.GenerateRequest{
				Model:             "gpt-4o",
				Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
				ConnectionOptions: connOpts(srv.URL, "sk-test"),
			})

			assert.ErrorIs(t, err, tc.want)
		})
	}
}

func TestGenerate_ContextCanceledNotFailover(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := openaicompatible.Generate(ctx, llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})

	require.Error(t, err)
	assert.False(t, llm.IsFailover(err))
}
