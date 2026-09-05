package llm

import (
	"context"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

// llmProvider is the concrete Provider built by CreateProvider, delegating
// each method to the corresponding func in api or modelLoader. A nil func
// means the provider doesn't support that action — the method returns a
// typed "not configured" error instead of panicking, so a provider can
// implement only the actions it actually supports.
type llmProvider struct {
	info        Info
	api         API
	modelLoader ModelLoader
}

func (d *llmProvider) Info() Info {
	return d.info
}

// Validate checks Info is well-formed, TestConnection is configured, and at
// least one action (Generate or Stream) is configured. It's called by
// CreateProvider and again by R.Register, so a provider with no usable
// action never enters a registry. A new action kind (embeddings, images,
// ...) joins this "at least one" check once a provider implements it.
func (d *llmProvider) Validate() error {
	if err := d.info.Validate(); err != nil {
		return err
	}
	if d.api.TestConnection == nil {
		return ErrTestConnectionNotConfigured
	}
	if d.api.Generate == nil && d.api.Stream == nil {
		return ErrNoActionConfigured
	}
	return nil
}

func (d *llmProvider) TestConnection(ctx context.Context, options TestConnectionOptions) error {
	return d.api.TestConnection(ctx, options)
}

func (d *llmProvider) Stream(ctx context.Context, options GenerateOptions) (StreamIterator, error) {
	if d.api.Stream == nil {
		return nil, ErrStreamNotConfigured
	}
	return d.api.Stream(ctx, options)
}

func (d *llmProvider) Generate(ctx context.Context, options GenerateOptions) (GenerateResult, error) {
	if d.api.Generate == nil {
		return GenerateResult{}, ErrGenerateNotConfigured
	}
	return d.api.Generate(ctx, options)
}

func (d *llmProvider) Models(ctx context.Context, config jsonx.JSONMap) ([]Model, error) {
	if d.modelLoader.Models == nil {
		return nil, ErrModelLoaderNotConfigured
	}
	return d.modelLoader.Models(ctx, config)
}

func (d *llmProvider) Model(ctx context.Context, config jsonx.JSONMap) (Model, error) {
	if d.modelLoader.Model == nil {
		return Model{}, ErrModelLoaderNotConfigured
	}
	return d.modelLoader.Model(ctx, config)
}
