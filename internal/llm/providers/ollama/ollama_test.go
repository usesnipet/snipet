package ollama_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/internal/infra/cache"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/llm/providers/ollama"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// newServer spins up a test server and returns connection options pointing
// at it (config.base_url = srv.URL).
func newServer(t *testing.T, h http.HandlerFunc) jsonx.JSONMap {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return configOpts(srv.URL)
}

func configOpts(baseURL string) jsonx.JSONMap {
	return jsonx.JSONMap{"config": jsonx.JSONMap{"base_url": baseURL}}
}

func TestInfo(t *testing.T) {
	t.Parallel()
	info := ollama.New().Info()

	assert.Equal(t, "ollama", info.Key)
	assert.Equal(t, "Ollama", info.Name)
	require.Len(t, info.Auth, 1)
	assert.Equal(t, llm.AuthTypeNone, info.Auth[0].Type)
	assert.NotNil(t, info.Schemas.Config)
}

func TestImplementsCapabilities(t *testing.T) {
	t.Parallel()
	var p any = ollama.New()

	_, isGenerator := p.(llm.Generator)
	_, isStreamer := p.(llm.Streamer)
	_, isHealth := p.(llm.HealthChecker)

	assert.True(t, isGenerator)
	assert.True(t, isStreamer)
	assert.True(t, isHealth)
}

func TestRegistersInRegistry(t *testing.T) {
	t.Parallel()
	r := llm.NewRegistry(cache.NewMemoryCache(0, 0), time.Minute)

	require.NoError(t, r.Register(ollama.New()))
	assert.True(t, r.Has("ollama"))
}

func TestModels(t *testing.T) {
	t.Parallel()
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/tags", r.URL.Path)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"models": []map[string]any{
				{"name": "llama3.2:latest", "model": "llama3.2:latest"},
				{"name": "qwen2.5:7b", "model": "qwen2.5:7b"},
			},
		})
	})

	models, err := ollama.New().Models(context.Background(), opts)

	require.NoError(t, err)
	require.Len(t, models, 2)
	assert.Equal(t, "llama3.2:latest", models[0].Key)
}

func TestModels_DefaultsToLocalServerWhenNoBaseURLGiven(t *testing.T) {
	t.Parallel()

	_, err := ollama.New().Models(context.Background(), nil)

	// Whether or not a local Ollama happens to be running in this environment,
	// a missing base_url must not fail schema validation up front — it should
	// fall back to the default address instead.
	assert.NotErrorIs(t, err, llm.ErrInvalidOptions)
}

func TestHealthCheck(t *testing.T) {
	t.Parallel()

	t.Run("ok", func(t *testing.T) {
		opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "/api/version", r.URL.Path)
			_ = json.NewEncoder(w).Encode(map[string]string{"version": "0.5.0"})
		})
		p := ollama.New().(llm.HealthChecker)
		assert.NoError(t, p.HealthCheck(context.Background(), opts))
	})

	t.Run("server down", func(t *testing.T) {
		opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		p := ollama.New().(llm.HealthChecker)
		err := p.HealthCheck(context.Background(), opts)
		assert.ErrorIs(t, err, llm.ErrUnavailable)
	})
}

func TestGenerate(t *testing.T) {
	t.Parallel()
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/chat/completions", r.URL.Path)

		var body map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, false, body["stream"])
		assert.Equal(t, "llama3.2", body["model"])

		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message":       map[string]any{"role": "assistant", "content": "hello there"},
				"finish_reason": "stop",
			}},
			"usage": map[string]any{"prompt_tokens": 11, "completion_tokens": 7},
		})
	})

	resp, err := ollama.New().(llm.Generator).Generate(context.Background(), llm.GenerateRequest{
		Model:             "llama3.2",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: opts,
	})

	require.NoError(t, err)
	assert.Equal(t, llm.RoleAssistant, resp.Message.Role)
	require.Len(t, resp.Message.Parts, 1)
	text, ok := resp.Message.Parts[0].(llm.TextPart)
	require.True(t, ok)
	assert.Equal(t, "hello there", text.Text)
	assert.Equal(t, llm.FinishStop, resp.FinishReason)
	assert.Equal(t, 11, resp.Usage.InputTokens)
	assert.Equal(t, 7, resp.Usage.OutputTokens)
}

func TestGenerate_ToolCall(t *testing.T) {
	t.Parallel()
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message": map[string]any{
					"role": "assistant",
					"tool_calls": []map[string]any{{
						"id":       "call_1",
						"type":     "function",
						"function": map[string]any{"name": "get_weather", "arguments": `{"city":"SP"}`},
					}},
				},
				"finish_reason": "tool_calls",
			}},
		})
	})

	resp, err := ollama.New().(llm.Generator).Generate(context.Background(), llm.GenerateRequest{
		Model:             "llama3.2",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "weather?")},
		ConnectionOptions: opts,
		Tools: []llm.Tool{{
			Name:        "get_weather",
			Description: "get weather",
			Parameters:  jsonx.JSONMap{"type": "object"},
		}},
	})

	require.NoError(t, err)
	assert.Equal(t, llm.FinishToolCall, resp.FinishReason)
	require.Len(t, resp.Message.Parts, 1)
	call, ok := resp.Message.Parts[0].(llm.ToolCallPart)
	require.True(t, ok)
	assert.Equal(t, "get_weather", call.Name)
	assert.JSONEq(t, `{"city":"SP"}`, string(call.Arguments))
	assert.Equal(t, "call_1", call.ID)
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
		{http.StatusBadGateway, llm.ErrUnavailable},
	}
	for _, tc := range cases {
		t.Run(http.StatusText(tc.status), func(t *testing.T) {
			opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"message": "nope"}})
			})

			_, err := ollama.New().(llm.Generator).Generate(context.Background(), llm.GenerateRequest{
				Model:             "x",
				Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
				ConnectionOptions: opts,
			})

			assert.ErrorIs(t, err, tc.want)
		})
	}
}

func TestGenerate_ContextCanceledIsNotFailover(t *testing.T) {
	t.Parallel()
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := ollama.New().(llm.Generator).Generate(ctx, llm.GenerateRequest{
		Model:             "x",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: opts,
	})

	require.Error(t, err)
	assert.False(t, llm.IsFailover(err))
}

func TestStream(t *testing.T) {
	t.Parallel()
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/chat/completions", r.URL.Path)

		var body map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, true, body["stream"])

		w.Header().Set("Content-Type", "text/event-stream")
		for _, c := range []string{
			`data: {"choices":[{"delta":{"content":"Hel"}}]}`,
			`data: {"choices":[{"delta":{"content":"lo"}}]}`,
			`data: [DONE]`,
		} {
			_, _ = w.Write([]byte(c + "\n"))
			w.(http.Flusher).Flush()
		}
	})

	it, err := ollama.New().(llm.Streamer).Stream(context.Background(), llm.GenerateRequest{
		Model:             "llama3.2",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: opts,
	})
	require.NoError(t, err)
	defer it.Close()

	var got strings.Builder
	for it.Next(context.Background()) {
		delta, ok := it.Event().(llm.TextDeltaEvent)
		require.True(t, ok)
		got.WriteString(delta.Text)
	}

	require.NoError(t, it.Err())
	assert.Equal(t, "Hello", got.String())
}

func TestStream_ErrorStatusBeforeStream(t *testing.T) {
	t.Parallel()
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"message": "loading"}})
	})

	_, err := ollama.New().(llm.Streamer).Stream(context.Background(), llm.GenerateRequest{
		Model:             "x",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: opts,
	})

	assert.ErrorIs(t, err, llm.ErrUnavailable)
}

func TestChatUsesV1Endpoint(t *testing.T) {
	t.Parallel()
	var gotPath string
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message":       map[string]any{"role": "assistant", "content": "ok"},
				"finish_reason": "stop",
			}},
		})
	})

	// config base_url without /v1 — provider must append it.
	_, err := ollama.New().(llm.Generator).Generate(context.Background(), llm.GenerateRequest{
		Model:             "llama3.2",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: opts,
	})

	require.NoError(t, err)
	assert.Equal(t, "/v1/chat/completions", gotPath)
}

func TestBaseURLFromConnectionOptions(t *testing.T) {
	t.Parallel()
	hit := false
	opts := newServer(t, func(w http.ResponseWriter, r *http.Request) {
		hit = true
		_ = json.NewEncoder(w).Encode(map[string]any{"models": []any{}})
	})

	_, err := ollama.New().Models(context.Background(), opts)

	require.NoError(t, err)
	assert.True(t, hit)
}
