package openaicompatible

import (
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

// newClient builds an openai-go client pointed at the resolved base URL with
// optional Bearer auth from cfg.APIKey.
func newClient(baseURL string, cfg Config) openai.Client {
	opts := []option.RequestOption{
		option.WithBaseURL(baseURL),
	}
	if cfg.APIKey != "" {
		opts = append(opts, option.WithAPIKey(cfg.APIKey))
	}
	return openai.NewClient(opts...)
}
