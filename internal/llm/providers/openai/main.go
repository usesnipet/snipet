package openai

import (
	llm "github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
)

const baseURL = "https://api.openai.com/v1"

func New() (llm.IProvider, error) {
	return llm.CreateProvider(
		llm.WithKey("openai"),
		llm.WithName("OpenAI"),
		llm.WithDescription("OpenAI language models."),
		llm.WithIcon("https://openai.com/favicon.ico"),
		llm.WithTags("language", "model", "llm"),
		llm.WithAuthConfigSchema(openaicompatible.DefaultAuthConfigSchema),
		llm.WithGenerateConfigSchema(openaicompatible.DefaultGenerateConfigSchema),
		llm.WithAPI(openaicompatible.New(baseURL)),
	)
}
