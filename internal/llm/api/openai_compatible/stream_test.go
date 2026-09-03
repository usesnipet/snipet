package openaicompatible

import (
	"context"
	"testing"

	"github.com/openai/openai-go/v3"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/llm"
)

type fakeChunkStream struct {
	chunks []openai.ChatCompletionChunk
	idx    int
	err    error
}

func (s *fakeChunkStream) Next() bool {
	if s.idx >= len(s.chunks) {
		return false
	}
	s.idx++
	return true
}

func (s *fakeChunkStream) Current() openai.ChatCompletionChunk {
	return s.chunks[s.idx-1]
}

func (s *fakeChunkStream) Err() error {
	return s.err
}

func collectChunks(t *testing.T, chunks ...openai.ChatCompletionChunk) []llm.StreamEvent {
	t.Helper()
	it := newStreamIterator(&fakeChunkStream{chunks: chunks}, nil)

	events := make([]llm.StreamEvent, 0, len(chunks))
	for it.Next(context.Background()) {
		events = append(events, it.Event())
	}
	require.NoError(t, it.Err())
	return events
}

func TestConsumeStreamEmitsTextDeltas(t *testing.T) {
	events := collectChunks(t,
		openai.ChatCompletionChunk{Choices: []openai.ChatCompletionChunkChoice{{
			Delta: openai.ChatCompletionChunkChoiceDelta{Content: "Hello"},
		}}},
		openai.ChatCompletionChunk{Choices: []openai.ChatCompletionChunkChoice{{
			Delta:        openai.ChatCompletionChunkChoiceDelta{Content: " world"},
			FinishReason: "stop",
		}}},
	)

	require.Len(t, events, 2)
	require.Equal(t, llm.TextDeltaEvent{Text: "Hello"}, events[0])
	require.Equal(t, llm.TextDeltaEvent{Text: " world"}, events[1])
}
