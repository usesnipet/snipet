package openaicompatible

import (
	"context"

	"github.com/usesnipet/snipet/internal/llm"
)

// New returns an llm.API that talks to an OpenAI-compatible Chat Completions
// endpoint via the official openai-go SDK. baseURL is the API root
// (e.g. "https://api.openai.com/v1"). AuthConfig.Endpoint, when set,
// overrides baseURL at request time.
func New(baseURL string) llm.API {
	return llm.API{
		TestConnection: func(ctx context.Context, options llm.TestConnectionOptions) error {
			return testConnection(ctx, baseURL, options)
		},
		Generate: func(ctx context.Context, options llm.GenerateOptions) (llm.GenerateResult, error) {
			return generate(ctx, baseURL, options)
		},
		Stream: func(ctx context.Context, options llm.GenerateOptions) (llm.StreamIterator, error) {
			return stream(ctx, baseURL, options)
		},
	}
}
