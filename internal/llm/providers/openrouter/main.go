package openrouter

import (
	llm "github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
)

const baseURL = "https://openrouter.ai/api/v1"

func New() (llm.IProvider, error) {
	return llm.CreateProvider(
		llm.WithKey("openrouter"),
		llm.WithName("OpenRouter"),
		llm.WithDescription("OpenRouter multi-provider models."),
		llm.WithIcon("https://openrouter.ai/favicon.ico"),
		llm.WithTags("language", "model", "llm"),
		llm.WithAuthConfigSchema(openaicompatible.DefaultAuthConfigSchema),
		llm.WithGenerateConfigSchema(openaicompatible.DefaultGenerateConfigSchema),
		llm.WithAPI(openaicompatible.New(baseURL)),
	)
}
