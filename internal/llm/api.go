package llm

import (
	"context"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

// API holds the provider methods used by a driver for connectivity checks and generation.
type API struct {
	TestConnection func(ctx context.Context, config jsonx.JSONMap) error
	Stream         func(ctx context.Context, config jsonx.JSONMap, options GenerateOptions) (StreamIterator, error)
	Generate       func(ctx context.Context, config jsonx.JSONMap, options GenerateOptions) (GenerateResult, error)
}
