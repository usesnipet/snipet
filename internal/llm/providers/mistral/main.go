package mistral

import (
	llm "github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
)

const baseURL = "https://api.mistral.ai/v1"

func New() (llm.IProvider, error) {
	return llm.CreateProvider(
		llm.WithKey("mistral"),
		llm.WithName("Mistral"),
		llm.WithDescription("Mistral language models."),
		llm.WithIcon("https://mistral.ai/favicon.ico"),
		llm.WithTags("language", "model", "llm"),
		llm.WithAuthConfigSchema(openaicompatible.DefaultAuthConfigSchema),
		llm.WithGenerateConfigSchema(openaicompatible.DefaultGenerateConfigSchema),
		llm.WithAPI(openaicompatible.New(baseURL)),
	)
}
