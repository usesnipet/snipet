package ollama

import (
	_ "embed"

	llm "github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
)

//go:embed auth_schema.json
var authSchemaJSON []byte

const defaultBaseURL = "http://localhost:11434/v1"

func New() (llm.IProvider, error) {
	return llm.CreateProvider(
		llm.WithKey("ollama"),
		llm.WithName("Ollama"),
		llm.WithDescription("Local Ollama models."),
		llm.WithIcon("https://ollama.com/public/icon.png"),
		llm.WithTags("language", "model", "llm", "local"),
		llm.WithAuthConfigSchema(llm.MustLoadSchema(authSchemaJSON)),
		llm.WithGenerateConfigSchema(openaicompatible.DefaultGenerateConfigSchema),
		llm.WithAPI(openaicompatible.New(defaultBaseURL)),
		llm.WithModelLoader(modelLoader),
	)
}
