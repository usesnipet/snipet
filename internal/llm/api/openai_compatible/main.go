package openaicompatible

import (
	"context"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// New returns an llm.API that talks to an OpenAI-compatible Chat Completions
// endpoint via the official openai-go SDK. baseURL is the API root
// (e.g. "https://api.openai.com/v1"). Config.Endpoint, when set, overrides
// baseURL at request time.
func New(baseURL string) llm.API {
	return llm.API{
		TestConnection: func(ctx context.Context, config jsonx.JSONMap) error {
			return testConnection(ctx, baseURL, config)
		},
		Stream: func(ctx context.Context, config jsonx.JSONMap, options llm.GenerateOptions) (llm.StreamIterator, error) {
			return stream(ctx, baseURL, config, options)
		},
		Generate: func(ctx context.Context, config jsonx.JSONMap, options llm.GenerateOptions) (llm.GenerateResult, error) {
			return generate(ctx, baseURL, config, options)
		},
	}
}
