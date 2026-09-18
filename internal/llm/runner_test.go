package llm_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// --- test doubles -----------------------------------------------------------

// streamProvider implements llm.Provider + llm.Streamer. If streamErr is set,
// Stream fails immediately (before any event); otherwise it returns a
// sliceIterator over events (with err surfacing after they're drained).
type streamProvider struct {
	key       string
	models    []llm.Model
	streamErr error
	events    []llm.StreamEvent
	err       error
}

func (p *streamProvider) Info() llm.Info { return llm.Info{Key: p.key} }
func (p *streamProvider) Models(context.Context, jsonx.JSONMap) ([]llm.Model, error) {
	return p.models, nil
}
func (p *streamProvider) Stream(context.Context, llm.GenerateRequest) (llm.StreamIterator, error) {
	if p.streamErr != nil {
		return nil, p.streamErr
	}
	return &sliceIterator{events: p.events, err: p.err}, nil
}

type sliceIterator struct {
	events []llm.StreamEvent
	err    error
	idx    int
	cur    llm.StreamEvent
}

func (s *sliceIterator) Next(context.Context) bool {
	if s.idx >= len(s.events) {
		return false
	}
	s.cur = s.events[s.idx]
	s.idx++
	return true
}
func (s *sliceIterator) Event() llm.StreamEvent { return s.cur }
func (s *sliceIterator) Err() error             { return s.err }
func (s *sliceIterator) Close() error           { return nil }

func streamRunner(t *testing.T, providers ...*streamProvider) *llm.Runner {
	t.Helper()
	r := newRegistry()
	for _, p := range providers {
		require.NoError(t, r.Register(p))
	}
	return llm.NewRunner(r)
}

func drain(t *testing.T, it llm.StreamIterator) []llm.StreamEvent {
	t.Helper()
	var events []llm.StreamEvent
	for it.Next(context.Background()) {
		events = append(events, it.Event())
	}
	return events
}

// --- Stream ---------------------------------------------------------------

func TestRunner_Stream_StartsThenAssemblesMessage(t *testing.T) {
	t.Parallel()
	p := &streamProvider{
		key:    "openai",
		models: []llm.Model{{Key: "gpt-4o"}},
		events: []llm.StreamEvent{
			llm.TextDeltaEvent{Text: "Hello "},
			llm.TextDeltaEvent{Text: "world"},
			llm.ToolCallEvent{ID: "1", Name: "foo", Arguments: json.RawMessage(`{}`)},
		},
	}
	r := streamRunner(t, p)

	it, err := r.Stream(context.Background(), []llm.Target{{Model: "openai/gpt-4o"}}, nil, nil)
	require.NoError(t, err)
	defer it.Close()

	events := drain(t, it)
	require.NoError(t, it.Err())

	require.Len(t, events, 5)
	assert.Equal(t, llm.LLMStartEvent{LLM: "openai/gpt-4o"}, events[0])
	assert.Equal(t, llm.TextDeltaEvent{Text: "Hello "}, events[1])
	assert.Equal(t, llm.TextDeltaEvent{Text: "world"}, events[2])
	assert.Equal(t, llm.ToolCallEvent{ID: "1", Name: "foo", Arguments: json.RawMessage(`{}`)}, events[3])

	msgEvent, ok := events[4].(llm.MessageEvent)
	require.True(t, ok, "last event should be a MessageEvent, got %T", events[4])
	assert.Equal(t, llm.RoleAssistant, msgEvent.Message.Role)
	assert.Equal(t, []llm.Part{
		llm.TextPart{Text: "Hello world"},
		llm.ToolCallPart{ID: "1", Name: "foo", Arguments: json.RawMessage(`{}`)},
	}, msgEvent.Message.Parts)
}

func TestRunner_Stream_SkipsFailedTargetThenSucceeds(t *testing.T) {
	t.Parallel()
	badErr := fmt.Errorf("down: %w", llm.ErrUnavailable)
	bad := &streamProvider{key: "a", models: []llm.Model{{Key: "gpt"}}, streamErr: badErr}
	good := &streamProvider{
		key:    "b",
		models: []llm.Model{{Key: "gpt"}},
		events: []llm.StreamEvent{llm.TextDeltaEvent{Text: "hi"}},
	}
	r := streamRunner(t, bad, good)

	it, err := r.Stream(context.Background(), []llm.Target{{Model: "a/gpt"}, {Model: "b/gpt"}}, nil, nil)
	require.NoError(t, err)
	defer it.Close()

	events := drain(t, it)
	require.NoError(t, it.Err())

	require.Len(t, events, 4)
	skipped, ok := events[0].(llm.LLMSkippedEvent)
	require.True(t, ok, "first event should be LLMSkippedEvent, got %T", events[0])
	assert.Equal(t, "a/gpt", skipped.LLM)
	assert.Contains(t, skipped.Error, badErr.Error())

	assert.Equal(t, llm.LLMStartEvent{LLM: "b/gpt"}, events[1])
	assert.Equal(t, llm.TextDeltaEvent{Text: "hi"}, events[2])
	assert.IsType(t, llm.MessageEvent{}, events[3])
}

func TestRunner_Stream_AllTargetsFailDrainsSkipsThenFailoverError(t *testing.T) {
	t.Parallel()
	a := &streamProvider{key: "a", models: []llm.Model{{Key: "gpt"}}, streamErr: llm.ErrUnavailable}
	b := &streamProvider{key: "b", models: []llm.Model{{Key: "gpt"}}, streamErr: llm.ErrRateLimit}
	r := streamRunner(t, a, b)

	it, err := r.Stream(context.Background(), []llm.Target{{Model: "a/gpt"}, {Model: "b/gpt"}}, nil, nil)
	require.NoError(t, err)
	defer it.Close()

	events := drain(t, it)

	require.Len(t, events, 2)
	assert.Equal(t, "a/gpt", events[0].(llm.LLMSkippedEvent).LLM)
	assert.Equal(t, "b/gpt", events[1].(llm.LLMSkippedEvent).LLM)

	var failover *llm.FailoverError
	require.ErrorAs(t, it.Err(), &failover)
	assert.Len(t, failover.Attempts, 2)
}

func TestRunner_Stream_FatalErrorIsReturnedImmediately(t *testing.T) {
	t.Parallel()
	r := streamRunner(t)

	_, err := r.Stream(context.Background(), []llm.Target{{Model: "ghost/gpt"}}, nil, nil)

	assert.ErrorIs(t, err, llm.ErrProviderNotFound)
}

func TestRunner_Stream_NoTargets(t *testing.T) {
	t.Parallel()
	r := streamRunner(t)

	_, err := r.Stream(context.Background(), nil, nil, nil)

	assert.ErrorIs(t, err, llm.ErrBadRequest)
}

func TestRunner_Stream_LateErrorSurfacesWithoutMessageEvent(t *testing.T) {
	t.Parallel()
	streamFail := errors.New("boom mid-stream")
	p := &streamProvider{
		key:    "openai",
		models: []llm.Model{{Key: "gpt-4o"}},
		events: []llm.StreamEvent{llm.TextDeltaEvent{Text: "partial"}},
		err:    streamFail,
	}
	r := streamRunner(t, p)

	it, err := r.Stream(context.Background(), []llm.Target{{Model: "openai/gpt-4o"}}, nil, nil)
	require.NoError(t, err)
	defer it.Close()

	events := drain(t, it)

	require.Len(t, events, 2)
	assert.Equal(t, llm.LLMStartEvent{LLM: "openai/gpt-4o"}, events[0])
	assert.Equal(t, llm.TextDeltaEvent{Text: "partial"}, events[1])
	assert.ErrorIs(t, it.Err(), streamFail)
}
