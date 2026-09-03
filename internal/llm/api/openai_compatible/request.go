package openaicompatible

import (
	"github.com/openai/openai-go/v3"
	"github.com/usesnipet/snipet/internal/llm"
)

// buildChatParams translates a GenerateOptions/Config pair into openai-go
// Chat Completions params. Optional numeric fields left at zero are omitted.
func buildChatParams(cfg Config, options llm.GenerateOptions) openai.ChatCompletionNewParams {
	params := openai.ChatCompletionNewParams{
		Model:    cfg.Model,
		Messages: buildMessages(options.Prompt),
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

// buildMessages converts a llm.Prompt into openai-go message params,
// prepending a system message when Prompt.System is set and dropping any
// message whose Role has no OpenAI equivalent.
func buildMessages(prompt llm.Prompt) []openai.ChatCompletionMessageParamUnion {
	messages := make([]openai.ChatCompletionMessageParamUnion, 0, len(prompt.Messages)+1)
	if prompt.System != "" {
		messages = append(messages, openai.SystemMessage(prompt.System))
	}
	for _, m := range prompt.Messages {
		switch m.Role {
		case llm.RoleSystem:
			messages = append(messages, openai.SystemMessage(m.Content))
		case llm.RoleUser:
			messages = append(messages, openai.UserMessage(m.Content))
		case llm.RoleAssistant:
			messages = append(messages, buildAssistantMessage(m))
		}
	}
	return messages
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
