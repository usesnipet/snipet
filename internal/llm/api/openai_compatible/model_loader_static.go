package openaicompatible

import (
	"context"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

func NewStaticModelLoader(models []llm.Model) llm.ModelLoader {
	return llm.ModelLoader{
		Models: func(ctx context.Context, config jsonx.JSONMap) ([]llm.Model, error) {
			return models, nil
		},
		Model: func(ctx context.Context, config jsonx.JSONMap) (llm.Model, error) {
			cfg, err := NewGenerateConfig(config)
			if err != nil {
				return llm.Model{}, err
			}

			for _, model := range models {
				if model.Name == cfg.Model {
					return model, nil
				}
			}
			return llm.Model{}, llm.ErrModelNotFound
		},
	}
}
