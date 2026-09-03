package openaicompatible

import (
	"context"
	"fmt"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// generate performs a non-streaming chat completion and returns the
// assistant text plus any tool calls from the first choice.
func generate(ctx context.Context, defaultBaseURL string, config jsonx.JSONMap, options llm.GenerateOptions) (llm.GenerateResult, error) {
	cfg, err := NewConfig(config)
	if err != nil {
		return llm.GenerateResult{}, err
	}

	baseURL, err := resolveBaseURL(defaultBaseURL, cfg)
	if err != nil {
		return llm.GenerateResult{}, err
	}

	client := newClient(baseURL, cfg)
	params := buildChatParams(cfg, options)

	completion, err := client.Chat.Completions.New(ctx, params)
	if err != nil {
		return llm.GenerateResult{}, fmt.Errorf("chat completions: %w", err)
	}
	if len(completion.Choices) == 0 {
		return llm.GenerateResult{}, fmt.Errorf("chat completions: empty choices")
	}

	message := completion.Choices[0].Message
	result := llm.GenerateResult{
		Text: message.Content,
	}
	return result, nil
}
