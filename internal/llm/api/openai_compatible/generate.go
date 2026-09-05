package openaicompatible

import (
	"context"
	"fmt"

	"github.com/usesnipet/snipet/internal/llm"
)

// Generate performs a non-streaming chat completion and returns the
// assistant text plus any tool calls from the first choice.
func Generate(ctx context.Context, defaultBaseURL string, options llm.GenerateOptions) (llm.GenerateResult, error) {
	authCfg, err := NewAuthConfig(options.AuthConfig)
	if err != nil {
		return llm.GenerateResult{}, err
	}
	genCfg, err := NewGenerateConfig(options.GenerateConfig)
	if err != nil {
		return llm.GenerateResult{}, err
	}

	baseURL, err := ResolveBaseURL(defaultBaseURL, authCfg)
	if err != nil {
		return llm.GenerateResult{}, err
	}

	client := NewClient(baseURL, authCfg)
	params := BuildChatParams(genCfg, options)

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
