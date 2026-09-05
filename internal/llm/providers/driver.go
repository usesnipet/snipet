package providers

import (
	"github.com/usesnipet/snipet/internal/llm/providers/groq"
	"github.com/usesnipet/snipet/internal/llm/providers/mistral"
	"github.com/usesnipet/snipet/internal/llm/providers/ollama"
	"github.com/usesnipet/snipet/internal/llm/providers/openai"
	"github.com/usesnipet/snipet/internal/llm/providers/openrouter"
	"github.com/usesnipet/snipet/internal/llm/registry"
	"github.com/usesnipet/snipet/internal/logger"
)

// Registry builds the LLM provider registry. A provider that fails to
// construct (e.g. a required option wasn't set) is logged and skipped
// rather than crashing the whole registry.
func Registry(log *logger.Logger) *registry.Registry {
	r := registry.NewRegistry(log)

	r.Register(openai.New())
	r.Register(groq.New())
	r.Register(ollama.New())
	r.Register(mistral.New())
	r.Register(openrouter.New())

	return r
}
