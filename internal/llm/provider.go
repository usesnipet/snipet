package llm

import (
	"context"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

// GenerateRequest carries the inputs to Generator.Generate and Streamer.Stream.
type GenerateRequest struct {
	Messages []Message
	Model    string // provider model key, e.g. "gpt-4o"

	Tools             []Tool        // optional
	ExtraOptions      jsonx.JSONMap // optional; validated against Info().Schemas
	ConnectionOptions jsonx.JSONMap // {auth: {...}, config: {...}}
}

// Provider is the minimum a provider driver implements: its static Info and
// its model catalog. Generation is layered on through the optional capability
// interfaces below (Generator, Streamer, HealthChecker); a caller type-asserts
// for the one it needs.
//
// connectionOptions is the nested {auth, config} map; use AuthSection /
// ConfigSection to read a piece of it.
type Provider interface {
	Info() Info
	Models(ctx context.Context, connectionOptions jsonx.JSONMap) ([]Model, error)
}

// HealthChecker is an optional Provider capability: a liveness / credential
// check for the given connection options.
type HealthChecker interface {
	HealthCheck(ctx context.Context, connectionOptions jsonx.JSONMap) error
}

// Generator is an optional Provider capability: run the model once and return
// the whole result.
type Generator interface {
	Generate(ctx context.Context, req GenerateRequest) (Response, error)
}

// Streamer is an optional Provider capability: run the model and stream the
// result incrementally.
type Streamer interface {
	Stream(ctx context.Context, req GenerateRequest) (StreamIterator, error)
}
