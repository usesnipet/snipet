package openaicompatible

import (
	"github.com/openai/openai-go/v3"
	"github.com/usesnipet/snipet/internal/llm"
)

// buildChatParams translates a GenerateOptions/GenerateConfig pair into
// openai-go Chat Completions params. Optional numeric fields left at zero
// are omitted.
func buildChatParams(cfg GenerateConfig, options llm.GenerateOptions) openai.ChatCompletionNewParams {
	params := openai.ChatCompletionNewParams{
		Model:    cfg.Model,
		Messages: buildMessages(options.Messages),
	}

	if cfg.MaxTokens != 0 {
		params.MaxTokens = openai.Int(int64(cfg.MaxTokens))
	}
	if cfg.Temperature != 0 {
		params.Temperature = openai.Float(cfg.Temperature)
	}
	if cfg.TopP != 0 {
		params.TopP = openai.Float(cfg.TopP)
	}

	return params
}

// buildMessages converts llm.Messages into openai-go message params,
// dropping any message whose Role has no OpenAI equivalent.
func buildMessages(messages []llm.Message) []openai.ChatCompletionMessageParamUnion {
	params := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages))
	for _, m := range messages {
		switch m.Role {
		case llm.RoleSystem:
			params = append(params, openai.SystemMessage(m.Content))
		case llm.RoleUser:
			params = append(params, openai.UserMessage(m.Content))
		case llm.RoleAssistant:
			params = append(params, buildAssistantMessage(m))
		}
	}
	return params
}

// buildAssistantMessage builds an assistant turn, including tool_calls when
// present. Content is always set (even to "") so Ollama-compatible servers
// that reject missing content on tool-call-only messages keep working.
func buildAssistantMessage(m llm.Message) openai.ChatCompletionMessageParamUnion {
	assistant := openai.ChatCompletionAssistantMessageParam{
		Content: openai.ChatCompletionAssistantMessageParamContentUnion{
			OfString: openai.String(m.Content),
		},
	}
	return openai.ChatCompletionMessageParamUnion{OfAssistant: &assistant}
}
