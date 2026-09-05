package openaicompatible

import (
	"context"

	"github.com/usesnipet/snipet/internal/llm"
)

// New bundles TestConnection, Generate and Stream against an
// OpenAI-compatible Chat Completions endpoint via the official openai-go
// SDK. baseURL is the API root (e.g. "https://api.openai.com/v1").
// AuthConfig.Endpoint, when set, overrides baseURL at request time.
//
// It's convenience sugar over the package's exported Generate/Stream/
// TestConnection funcs for a provider that wants all three as-is. A provider
// that needs something different for one action (its own TestConnection, an
// embeddings call, a native model-listing endpoint, ...) should wire llm.API
// by hand from those funcs instead of using New.
func New(baseURL string) llm.API {
	return llm.API{
		TestConnection: func(ctx context.Context, options llm.TestConnectionOptions) error {
			return TestConnection(ctx, baseURL, options)
		},
		Generate: func(ctx context.Context, options llm.GenerateOptions) (llm.GenerateResult, error) {
			return Generate(ctx, baseURL, options)
		},
		Stream: func(ctx context.Context, options llm.GenerateOptions) (llm.StreamIterator, error) {
			return Stream(ctx, baseURL, options)
		},
	}
}
