package llm

import (
	"context"
	"encoding/json"
)

// StreamEvent is a sealed interface implemented by every event a
// StreamIterator can yield. Consumers type-switch on the concrete event
// types below (TextDeltaEvent, ToolCallEvent); no other package can
// implement StreamEvent.
type StreamEvent interface {
	isStreamEvent()
}
type streamEvent struct{}

func (streamEvent) isStreamEvent() {}

// TextDeltaEvent carries an incremental chunk of assistant text output.
type TextDeltaEvent struct {
	streamEvent
	Text string `json:"text"`
}

// ToolCallEvent carries a complete tool call the assistant requested during a
// stream. A provider emits it once the call's name and arguments are known.
type ToolCallEvent struct {
	streamEvent
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// StreamIterator walks the events produced by Provider.API.Stream, cursor-style:
// call Next until it returns false, reading Event after each successful
// Next. Err reports any error that stopped iteration (nil on a clean
// end-of-stream); Close releases underlying resources regardless of how
// iteration ended.
type StreamIterator interface {
	Next(ctx context.Context) bool
	Event() StreamEvent
	Err() error
	Close() error
}
