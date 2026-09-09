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
	Model        string        // "provider-key/model"
	ExtraOptions jsonx.JSONMap // optional; validated against the provider's schema
	AuthOptions  jsonx.JSONMap
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

// Stream tries each target in order and returns the first stream that yields
// its first event without error. Failover happens only before that first
// event: a failover error before it moves to the next target; once the first
// event is buffered, any later error surfaces through the returned iterator.
// A fatal error before the first event is returned immediately; if every
// target fails, the result is a *FailoverError.
func (r *Runner) Stream(ctx context.Context, targets []Target, messages []Message, tools []Tool) (StreamIterator, error) {
	if len(targets) == 0 {
		return nil, fmt.Errorf("%w: no targets", ErrBadRequest)
	}

	var attempts []Attempt
	for _, t := range targets {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		it, err := r.streamOne(ctx, t, messages, tools)
		if err == nil {
			return it, nil
		}
		if !IsFailover(err) {
			return nil, err
		}
		attempts = append(attempts, Attempt{LLM: t.Model, Err: err})
	}
	return nil, &FailoverError{Attempts: attempts}
}

func (r *Runner) generateOne(ctx context.Context, t Target, messages []Message, tools []Tool) (Response, error) {
	p, modelKey, err := r.resolve(ctx, t, kindGenerate)
	if err != nil {
		return Response{}, err
	}
	g, ok := p.(Generator)
	if !ok {
		return Response{}, fmt.Errorf("%w: %q does not support generate", ErrBadRequest, t.Model)
	}
	return g.Generate(ctx, r.request(t, modelKey, messages, tools))
}

func (r *Runner) streamOne(ctx context.Context, t Target, messages []Message, tools []Tool) (StreamIterator, error) {
	p, modelKey, err := r.resolve(ctx, t, kindStream)
	if err != nil {
		return nil, err
	}
	s, ok := p.(Streamer)
	if !ok {
		return nil, fmt.Errorf("%w: %q does not support stream", ErrBadRequest, t.Model)
	}

	inner, err := s.Stream(ctx, r.request(t, modelKey, messages, tools))
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

func (r *Runner) request(t Target, modelKey string, messages []Message, tools []Tool) GenerateRequest {
	return GenerateRequest{
		Messages:     messages,
		Model:        modelKey,
		Tools:        tools,
		ExtraOptions: t.ExtraOptions,
		AuthOptions:  t.AuthOptions,
	}
}

// callKind selects which extra-options schema resolve validates against.
type callKind int

const (
	kindGenerate callKind = iota
	kindStream
)

// resolve runs the plan's "Validate" step for one target: split the model
// ref, Connect (which health-checks and validates the auth options), confirm
// the model exists, and validate the extra options against the provider's
// schema. A bad ref, missing model, or schema failure is a fatal
// ErrBadRequest / ErrModelNotFound — never a failover.
func (r *Runner) resolve(ctx context.Context, t Target, kind callKind) (Provider, string, error) {
	providerKey, modelKey, ok := SplitModelRef(t.Model)
	if !ok {
		return nil, "", fmt.Errorf("%w: bad model ref %q", ErrBadRequest, t.Model)
	}

	p, err := r.registry.Connect(ctx, providerKey, t.AuthOptions)
	if err != nil {
		return nil, "", err
	}

	has, err := r.registry.HasModel(ctx, providerKey, modelKey, t.AuthOptions)
	if err != nil {
		return nil, "", err
	}
	if !has {
		return nil, "", fmt.Errorf("%w: %q", ErrModelNotFound, t.Model)
	}

	var schema jsonx.JSONMap
	switch kind {
	case kindGenerate:
		schema = p.Info().Schemas.GenerateExtraOptions
	case kindStream:
		schema = p.Info().Schemas.StreamExtraOptions
	}
	if schema != nil {
		opts := t.ExtraOptions
		if opts == nil {
			opts = jsonx.JSONMap{}
		}
		if err := jsonschema.Validate(schema, opts); err != nil {
			return nil, "", fmt.Errorf("%w: extra_options: %v", ErrBadRequest, err)
		}
	}
	return p, modelKey, nil
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
