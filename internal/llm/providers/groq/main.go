package groq

import (
	llm "github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
)

const baseURL = "https://api.groq.com/openai/v1"

func New() (llm.IProvider, error) {
	return llm.CreateProvider(
		llm.WithKey("groq"),
		llm.WithName("Groq"),
		llm.WithDescription("Groq high-speed inference models."),
		llm.WithIcon("https://groq.com/favicon.ico"),
		llm.WithTags("language", "model", "llm"),
		llm.WithConfigurationSchema(openaicompatible.DefaultConfigSchema),
		llm.WithAPI(openaicompatible.New(baseURL)),
	)
}
