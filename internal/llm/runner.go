package llm

import (
	"context"
	"fmt"
	"strings"

	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Target is one llm the Runner may try: a "provider-key/model" reference plus
// the options for that call.
type Target struct {
	Model             string        // "provider-key/model"
	ExtraOptions      jsonx.JSONMap // optional; validated against the provider's schema
	ConnectionOptions jsonx.JSONMap // {auth: {...}, config: {...}}
}

// Runner runs a conversation against an ordered list of Targets.
type Runner struct {
	registry *Registry
}

// NewRunner builds a Runner backed by registry.
func NewRunner(registry *Registry) *Runner {
	return &Runner{registry: registry}
}

// Generate tries each target in order and returns the first successful
// Response. A failover error moves to the next target; a fatal error is
// returned immediately; if every target fails, the result is a *FailoverError.
func (r *Runner) Generate(ctx context.Context, targets []Target, messages []Message, tools []Tool) (Response, error) {
	if len(targets) == 0 {
		return Response{}, fmt.Errorf("%w: no targets", ErrBadRequest)
	}

	var attempts []Attempt
	for _, t := range targets {
		if err := ctx.Err(); err != nil {
			return Response{}, err
		}

		resp, err := r.generateOne(ctx, t, messages, tools)
		if err == nil {
			return resp, nil
		}
		if !IsFailover(err) {
			return Response{}, err
		}
		attempts = append(attempts, Attempt{LLM: t.Model, Err: err})
	}
	return Response{}, &FailoverError{Attempts: attempts}
}

// Stream tries each target in order and returns an iterator that reports the
// whole attempt: an LLMSkippedEvent for each target skipped over, then an
// LLMStartEvent once one is chosen, that target's own events, and finally a
// MessageEvent assembling the full reply. Failover happens only before a
// target's first event: a failover error before it moves to the next
// target; once the first event is buffered, any later error surfaces
// through the returned iterator's Err. A fatal error before any target's
// first event is returned immediately; if every target fails, the returned
// iterator's Err is a *FailoverError once its skip events are drained.
func (r *Runner) Stream(ctx context.Context, targets []Target, messages []Message, tools []Tool) (StreamIterator, error) {
	if len(targets) == 0 {
		return nil, fmt.Errorf("%w: no targets", ErrBadRequest)
	}

	var queue []StreamEvent
	var attempts []Attempt
	for _, t := range targets {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		it, err := r.streamOne(ctx, t, messages, tools)
		if err == nil {
			queue = append(queue, LLMStartEvent{LLM: t.Model})
			return &runnerIterator{queue: queue, inner: it}, nil
		}
		if !IsFailover(err) {
			return nil, err
		}
		attempts = append(attempts, Attempt{LLM: t.Model, Err: err})
		queue = append(queue, LLMSkippedEvent{LLM: t.Model, Error: err.Error()})
	}
	return &runnerIterator{queue: queue, err: &FailoverError{Attempts: attempts}}, nil
}

func (r *Runner) generateOne(ctx context.Context, t Target, messages []Message, tools []Tool) (Response, error) {
	p, modelKey, extraOptions, err := r.resolve(ctx, t)
	if err != nil {
		return Response{}, err
	}
	g, ok := p.(Generator)
	if !ok {
		return Response{}, fmt.Errorf("%w: %q does not support generate", ErrBadRequest, t.Model)
	}
	return g.Generate(ctx, r.request(t, modelKey, extraOptions, messages, tools))
}

func (r *Runner) streamOne(ctx context.Context, t Target, messages []Message, tools []Tool) (StreamIterator, error) {
	p, modelKey, extraOptions, err := r.resolve(ctx, t)
	if err != nil {
		return nil, err
	}
	s, ok := p.(Streamer)
	if !ok {
		return nil, fmt.Errorf("%w: %q does not support stream", ErrBadRequest, t.Model)
	}

	inner, err := s.Stream(ctx, r.request(t, modelKey, extraOptions, messages, tools))
	if err != nil {
		return nil, err
	}

	// Failover is only allowed before the first event is yielded, so probe it.
	if inner.Next(ctx) {
		return &primedIterator{inner: inner, pending: inner.Event(), primed: true}, nil
	}
	if err := inner.Err(); err != nil {
		_ = inner.Close()
		return nil, err
	}
	return inner, nil // clean but empty stream
}

func (r *Runner) request(t Target, modelKey string, extraOptions jsonx.JSONMap, messages []Message, tools []Tool) GenerateRequest {
	return GenerateRequest{
		Messages:          messages,
		Model:             modelKey,
		Tools:             tools,
		ExtraOptions:      extraOptions,
		ConnectionOptions: t.ConnectionOptions,
	}
}

// resolve runs the plan's "Validate" step for one target: split the model
// ref, Connect (which validates the connection options and health-checks),
// confirm the model exists, and validate the extra options against the
// provider's schema. The returned extraOptions has the schema's defaults
// applied — pass it to the provider instead of t.ExtraOptions. A bad ref,
// missing model, or schema failure is a fatal ErrBadRequest / ErrModelNotFound
// — never a failover.
func (r *Runner) resolve(ctx context.Context, t Target) (p Provider, modelKey string, extraOptions jsonx.JSONMap, err error) {
	providerKey, modelKey, ok := SplitModelRef(t.Model)
	if !ok {
		return nil, "", nil, fmt.Errorf("%w: bad model ref %q", ErrBadRequest, t.Model)
	}

	p, err = r.registry.Connect(ctx, providerKey, t.ConnectionOptions)
	if err != nil {
		return nil, "", nil, err
	}

	has, err := r.registry.HasModel(ctx, providerKey, modelKey, t.ConnectionOptions)
	if err != nil {
		return nil, "", nil, err
	}
	if !has {
		return nil, "", nil, fmt.Errorf("%w: %q", ErrModelNotFound, t.Model)
	}

	schema := p.Info().Schemas.GenerateExtraOptions
	extraOptions = t.ExtraOptions
	if schema != nil {
		extraOptions, err = jsonschema.Validate(schema, t.ExtraOptions)
		if err != nil {
			return nil, "", nil, fmt.Errorf("%w: extra_options: %v", ErrBadRequest, err)
		}
	}
	return p, modelKey, extraOptions, nil
}

// SplitModelRef splits a "provider-key/model" reference on its first "/", so a
// model id may itself contain "/". ok is false if either side is empty.
func SplitModelRef(ref string) (providerKey, model string, ok bool) {
	i := strings.IndexByte(ref, '/')
	if i <= 0 || i == len(ref)-1 {
		return "", "", false
	}
	return ref[:i], ref[i+1:], true
}

// primedIterator replays one pre-fetched event, then delegates to inner. The
// Runner uses it to peek a stream's first event (to decide failover) without
// losing it.
type primedIterator struct {
	inner   StreamIterator
	pending StreamEvent
	primed  bool
	current StreamEvent
}

func (p *primedIterator) Next(ctx context.Context) bool {
	if p.primed {
		p.primed = false
		p.current = p.pending
		p.pending = nil
		return true
	}
	if p.inner.Next(ctx) {
		p.current = p.inner.Event()
		return true
	}
	p.current = nil
	return false
}

func (p *primedIterator) Event() StreamEvent { return p.current }
func (p *primedIterator) Err() error         { return p.inner.Err() }
func (p *primedIterator) Close() error       { return p.inner.Close() }

// runnerIterator is what Runner.Stream hands back. It first drains queue
// (the LLMSkippedEvent/LLMStartEvent bookkeeping already known once the
// target loop finished), then delegates to inner if one was chosen,
// accumulating its text and tool calls to emit a trailing MessageEvent once
// inner ends cleanly. If no target was chosen, inner is nil and err (already
// set) surfaces once queue drains.
type runnerIterator struct {
	queue   []StreamEvent
	current StreamEvent

	inner StreamIterator
	err   error

	text      strings.Builder
	toolCalls []Part
	assembled bool
}

func (r *runnerIterator) Next(ctx context.Context) bool {
	if len(r.queue) > 0 {
		r.current, r.queue = r.queue[0], r.queue[1:]
		return true
	}
	if r.inner == nil {
		return false
	}

	if r.inner.Next(ctx) {
		event := r.inner.Event()
		switch e := event.(type) {
		case TextDeltaEvent:
			r.text.WriteString(e.Text)
		case ToolCallEvent:
			r.toolCalls = append(r.toolCalls, ToolCallPart{ID: e.ID, Name: e.Name, Arguments: e.Arguments})
		}
		r.current = event
		return true
	}
	if err := r.inner.Err(); err != nil {
		r.err = err
		return false
	}
	if !r.assembled {
		r.assembled = true
		r.current = MessageEvent{Message: r.message()}
		return true
	}
	return false
}

func (r *runnerIterator) message() Message {
	var parts []Part
	if r.text.Len() > 0 {
		parts = append(parts, TextPart{Text: r.text.String()})
	}
	parts = append(parts, r.toolCalls...)
	return Message{Role: RoleAssistant, Parts: parts}
}

func (r *runnerIterator) Event() StreamEvent { return r.current }
func (r *runnerIterator) Err() error         { return r.err }

func (r *runnerIterator) Close() error {
	if r.inner == nil {
		return nil
	}
	return r.inner.Close()
}
