package llm

import (
	"context"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

// llmProvider is the concrete Provider built by CreateProvider, delegating each
// method to the corresponding func in api, if configured.
type llmProvider struct {
	info        Info
	api         API
	modelLoader ModelLoader
}

func (d *llmProvider) Info() Info {
	return d.info
}

// Validate checks Info is well-formed and TestConnection, Stream, and
// Generate are all configured. It's called by CreateProvider and again by
// R.Register, so a provider missing any of these never enters a registry.
func (d *llmProvider) Validate() error {
	if err := d.info.Validate(); err != nil {
		return err
	}
	if d.api.TestConnection == nil {
		return ErrTestConnectionNotConfigured
	}
	if d.api.Stream == nil {
		return ErrStreamNotConfigured
	}
	if d.api.Generate == nil {
		return ErrGenerateNotConfigured
	}
	return nil
}

func (d *llmProvider) TestConnection(ctx context.Context, config jsonx.JSONMap) error {
	return d.api.TestConnection(ctx, config)
}

func (d *llmProvider) Stream(ctx context.Context, config jsonx.JSONMap, options GenerateOptions) (StreamIterator, error) {
	return d.api.Stream(ctx, config, options)
}

func (d *llmProvider) Generate(ctx context.Context, config jsonx.JSONMap, options GenerateOptions) (GenerateResult, error) {
	return d.api.Generate(ctx, config, options)
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
