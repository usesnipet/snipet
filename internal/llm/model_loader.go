package llm

import (
	"context"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

type ModelLoader struct {
	Models func(ctx context.Context, config jsonx.JSONMap) ([]Model, error)
	Model  func(ctx context.Context, config jsonx.JSONMap) (Model, error)
}
