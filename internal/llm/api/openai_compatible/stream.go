package openaicompatible

import (
	"context"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/usesnipet/snipet/internal/llm"
)

// stream opens a chat completions SSE stream via openai-go and returns an
// llm.StreamIterator that translates chunks into llm.StreamEvent values as
// the caller pulls them via Next.
func stream(ctx context.Context, defaultBaseURL string, options llm.GenerateOptions) (llm.StreamIterator, error) {
	authCfg, err := NewAuthConfig(options.AuthConfig)
	if err != nil {
		return nil, err
	}
	genCfg, err := NewGenerateConfig(options.GenerateConfig)
	if err != nil {
		return nil, err
	}

	baseURL, err := resolveBaseURL(defaultBaseURL, authCfg)
	if err != nil {
		return nil, err
	}

	client := newClient(baseURL, authCfg)
	params := buildChatParams(genCfg, options)
	sdkStream := client.Chat.Completions.NewStreaming(ctx, params)

	return newStreamIterator(sdkStream, sdkStream.Close), nil
}

// sdkChunkStream is the slice of the openai-go SSE stream that
// streamIterator drives. It is narrowed to an interface so tests can fake it.
type sdkChunkStream interface {
	Next() bool
	Current() openai.ChatCompletionChunk
	Err() error
}

// streamIterator adapts an sdkChunkStream, which delivers raw chat
// completion chunks, into an llm.StreamIterator that yields llm.StreamEvent
// values one at a time: text deltas as they arrive, and tool-call deltas
// reassembled (by index) into a single ToolCallEvent once a chunk's
// FinishReason (or end of stream) confirms the call is complete. Malformed
// tool-call arguments are skipped (soft-fail).
type streamIterator struct {
	sdk     sdkChunkStream
	closeFn func() error

	pending []llm.StreamEvent
	event   llm.StreamEvent
	err     error
	done    bool

	flushed map[string]bool
}

func newStreamIterator(sdk sdkChunkStream, closeFn func() error) *streamIterator {
	return &streamIterator{
		sdk:     sdk,
		closeFn: closeFn,
		flushed: map[string]bool{},
	}
}

func (it *streamIterator) Next(ctx context.Context) bool {
	if it.done {
		return false
	}
	for len(it.pending) == 0 {
		if ctx.Err() != nil {
			it.err = ctx.Err()
			it.done = true
			return false
		}
		if !it.sdk.Next() {
			if err := it.sdk.Err(); err != nil {
				it.err = fmt.Errorf("read stream: %w", err)
				it.done = true
				return false
			}
			if len(it.pending) == 0 {
				it.done = true
				return false
			}
			break
		}
		it.consumeChunk(it.sdk.Current())
	}
	it.event, it.pending = it.pending[0], it.pending[1:]
	return true
}

func (it *streamIterator) Event() llm.StreamEvent { return it.event }
func (it *streamIterator) Err() error             { return it.err }

func (it *streamIterator) Close() error {
	if it.closeFn == nil {
		return nil
	}
	return it.closeFn()
}

func (it *streamIterator) consumeChunk(chunk openai.ChatCompletionChunk) {
	if len(chunk.Choices) == 0 {
		return
	}

	choice := chunk.Choices[0]
	delta := choice.Delta

	if delta.Content != "" {
		it.pending = append(it.pending, llm.TextDeltaEvent{Text: delta.Content})
	}
}
