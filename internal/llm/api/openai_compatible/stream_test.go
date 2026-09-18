package openaicompatible_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
)

func sseServer(t *testing.T, lines ...string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		for _, l := range lines {
			_, _ = w.Write([]byte(l + "\n"))
			w.(http.Flusher).Flush()
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func drain(t *testing.T, it llm.StreamIterator) (text string, tools []llm.ToolCallEvent) {
	t.Helper()
	var b strings.Builder
	for it.Next(context.Background()) {
		switch e := it.Event().(type) {
		case llm.TextDeltaEvent:
			b.WriteString(e.Text)
		case llm.ToolCallEvent:
			tools = append(tools, e)
		}
	}
	require.NoError(t, it.Err())
	return b.String(), tools
}

func TestStream_TextDeltas(t *testing.T) {
	t.Parallel()
	srv := sseServer(t,
		`data: {"choices":[{"delta":{"role":"assistant"}}]}`,
		`data: {"choices":[{"delta":{"content":"Hel"}}]}`,
		`data: {"choices":[{"delta":{"content":"lo"}}]}`,
		`data: {"choices":[{"delta":{},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
	)

	it, err := openaicompatible.Stream(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})
	require.NoError(t, err)
	defer it.Close()

	text, tools := drain(t, it)
	assert.Equal(t, "Hello", text)
	assert.Empty(t, tools)
}

func TestStream_AccumulatesToolCall(t *testing.T) {
	t.Parallel()
	srv := sseServer(t,
		`data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"search","arguments":""}}]}}]}`,
		`data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
		`data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"go\"}"}}]}}]}`,
		`data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: [DONE]`,
	)

	it, err := openaicompatible.Stream(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "search go")},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})
	require.NoError(t, err)
	defer it.Close()

	text, tools := drain(t, it)
	assert.Empty(t, text)
	require.Len(t, tools, 1)
	assert.Equal(t, "call_1", tools[0].ID)
	assert.Equal(t, "search", tools[0].Name)
	assert.JSONEq(t, `{"q":"go"}`, string(tools[0].Arguments))
}

func TestStream_FlushesToolCallOnEOFWithoutFinishReason(t *testing.T) {
	t.Parallel()
	srv := sseServer(t,
		`data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_9","function":{"name":"now","arguments":"{}"}}]}}]}`,
	)

	it, err := openaicompatible.Stream(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "time?")},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})
	require.NoError(t, err)
	defer it.Close()

	_, tools := drain(t, it)
	require.Len(t, tools, 1)
	assert.Equal(t, "now", tools[0].Name)
	assert.JSONEq(t, `{}`, string(tools[0].Arguments))
}

func TestStream_ErrorStatusBeforeStream(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"message":"slow down"}}`))
	}))
	defer srv.Close()

	_, err := openaicompatible.Stream(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})

	assert.ErrorIs(t, err, llm.ErrRateLimit)
}

func TestStream_ErrorInChunk(t *testing.T) {
	t.Parallel()
	srv := sseServer(t,
		`data: {"choices":[{"delta":{"content":"partial"}}]}`,
		`data: {"error":{"message":"upstream exploded"}}`,
	)

	it, err := openaicompatible.Stream(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: connOpts(srv.URL, "sk-test"),
	})
	require.NoError(t, err)
	defer it.Close()

	var got string
	for it.Next(context.Background()) {
		if e, ok := it.Event().(llm.TextDeltaEvent); ok {
			got += e.Text
		}
	}
	assert.Equal(t, "partial", got)
	assert.ErrorIs(t, it.Err(), llm.ErrUnavailable)
}

func TestStream_MissingBaseURLIsBadRequest(t *testing.T) {
	t.Parallel()

	_, err := openaicompatible.Stream(context.Background(), llm.GenerateRequest{
		Model:             "gpt-4o",
		Messages:          []llm.Message{llm.Text(llm.RoleUser, "hi")},
		ConnectionOptions: nil,
	})

	assert.ErrorIs(t, err, llm.ErrBadRequest)
}
