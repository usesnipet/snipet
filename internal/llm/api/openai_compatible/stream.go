package openaicompatible

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"resty.dev/v3"

	"github.com/usesnipet/snipet/internal/llm"
)

// Stream runs a streamed chat completion and returns an iterator over the
// deltas. It parses the Server-Sent Events response lazily: each Next reads
// the next `data:` line. Tool-call fragments are accumulated per index and
// emitted as one llm.ToolCallEvent when the call finishes.
func Stream(ctx context.Context, req llm.GenerateRequest) (llm.StreamIterator, error) {
	cfg, err := configFromOptions(req.ConnectionOptions)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", llm.ErrBadRequest, err)
	}

	client := resty.New()

	resp, err := newRequest(ctx, client, cfg).
		SetResponseDoNotParse(true).
		SetHeader("Accept", "text/event-stream").
		SetBody(buildBody(req, true)).
		Post("/chat/completions")
	if err != nil {
		client.Close()
		return nil, transportErr(err)
	}
	if resp.IsStatusFailure() {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		_ = resp.Body.Close()
		client.Close()

		var apiErr errorEnvelope
		_ = json.Unmarshal(raw, &apiErr)
		return nil, statusErr(resp.StatusCode(), apiErr.Error.Message)
	}

	return &sseIterator{
		client: client,
		body:   resp.Body,
		reader: bufio.NewReader(resp.Body),
	}, nil
}

// --- wire types ----------------------------------------------------------

type streamChunk struct {
	Choices []struct {
		Delta struct {
			Content   string                `json:"content"`
			ToolCalls []streamToolCallDelta `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type streamToolCallDelta struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// --- iterator ----------------------------------------------------------

type sseIterator struct {
	client *resty.Client
	body   io.ReadCloser
	reader *bufio.Reader

	cur    llm.StreamEvent
	queue  []llm.StreamEvent
	err    error
	done   bool
	closed bool

	tools     map[int]*accTool
	toolOrder []int
}

type accTool struct {
	id   string
	name string
	args strings.Builder
}

func (s *sseIterator) Next(ctx context.Context) bool {
	if s.err != nil {
		return false
	}
	if s.popQueue() {
		return true
	}
	if s.done {
		return false
	}

	for {
		if err := ctx.Err(); err != nil {
			s.err = err
			return false
		}

		line, err := s.reader.ReadString('\n')
		if err != nil {
			if err != io.EOF {
				s.err = fmt.Errorf("openai-compatible: read stream: %w", err)
				return false
			}
			s.enqueueTools()
			s.done = true
			return s.popQueue()
		}

		line = strings.TrimRight(line, "\r\n")
		if line == "" || strings.HasPrefix(line, ":") {
			continue // event separator or comment
		}
		payload, ok := strings.CutPrefix(line, "data:")
		if !ok {
			continue // ignore event:/id:/retry: fields
		}
		payload = strings.TrimSpace(payload)
		if payload == "[DONE]" {
			s.enqueueTools()
			s.done = true
			return s.popQueue()
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			s.err = fmt.Errorf("openai-compatible: decode stream chunk: %w", err)
			return false
		}
		if chunk.Error != nil && chunk.Error.Message != "" {
			s.err = fmt.Errorf("openai-compatible: %s: %w", chunk.Error.Message, llm.ErrUnavailable)
			return false
		}

		for _, choice := range chunk.Choices {
			if choice.Delta.Content != "" {
				s.queue = append(s.queue, llm.TextDeltaEvent{Text: choice.Delta.Content})
			}
			for _, td := range choice.Delta.ToolCalls {
				s.accumulateTool(td)
			}
			if choice.FinishReason == "tool_calls" || choice.FinishReason == "function_call" {
				s.enqueueTools()
			}
		}

		if s.popQueue() {
			return true
		}
		// role-only or keep-alive chunk: keep reading.
	}
}

func (s *sseIterator) Event() llm.StreamEvent { return s.cur }
func (s *sseIterator) Err() error             { return s.err }

func (s *sseIterator) Close() error {
	if s.closed {
		return nil
	}
	s.closed = true
	err := s.body.Close()
	s.client.Close()
	return err
}

func (s *sseIterator) popQueue() bool {
	if len(s.queue) == 0 {
		return false
	}
	s.cur, s.queue = s.queue[0], s.queue[1:]
	return true
}

func (s *sseIterator) accumulateTool(td streamToolCallDelta) {
	if s.tools == nil {
		s.tools = map[int]*accTool{}
	}
	at, ok := s.tools[td.Index]
	if !ok {
		at = &accTool{}
		s.tools[td.Index] = at
		s.toolOrder = append(s.toolOrder, td.Index)
	}
	if td.ID != "" {
		at.id = td.ID
	}
	if td.Function.Name != "" {
		at.name = td.Function.Name
	}
	at.args.WriteString(td.Function.Arguments)
}

// enqueueTools flushes every accumulated tool call as a complete
// llm.ToolCallEvent, in the order the calls first appeared.
func (s *sseIterator) enqueueTools() {
	for _, idx := range s.toolOrder {
		at := s.tools[idx]
		if at == nil {
			continue
		}
		args := at.args.String()
		if args == "" {
			args = "{}"
		}
		s.queue = append(s.queue, llm.ToolCallEvent{
			ID:        at.id,
			Name:      at.name,
			Arguments: json.RawMessage(args),
		})
	}
	s.tools = nil
	s.toolOrder = nil
}
