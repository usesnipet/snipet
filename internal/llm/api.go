package llm

import "context"

// API holds the funcs behind a provider's actions. TestConnection is
// required. Generate and Stream cover the text-generation action and are
// each optional — a provider sets only the ones it supports, and the
// corresponding IProvider method returns a "not configured" error when
// unset (see llmProvider). A future action kind (embeddings, images, audio,
// video, ...) gets its own optional func field here, following the same
// shape: an Options struct in, a typed Result out, nil meaning unsupported.
type API struct {
	TestConnection func(ctx context.Context, options TestConnectionOptions) error
	Generate       func(ctx context.Context, options GenerateOptions) (GenerateResult, error)
	Stream         func(ctx context.Context, options GenerateOptions) (StreamIterator, error)
}
