package ollama

import "github.com/usesnipet/snipet/internal/llm"

type ModelCapability string

const (
	CapabilityVision     ModelCapability = "vision"
	CapabilityCompletion ModelCapability = "completion"
	CapabilityTools      ModelCapability = "tools"
	CapabilityEmbedding  ModelCapability = "embedding"
	CapabilityThinking   ModelCapability = "thinking"
)

type CapabilityList []ModelCapability

func (cl CapabilityList) ToLLMCapabilities() []llm.Capability {
	llmCaps := make([]llm.Capability, 0, len(cl))

	for _, c := range cl {
		switch c {
		case CapabilityVision:
			llmCaps = append(llmCaps, llm.CapabilityVision)

		case CapabilityCompletion:
			llmCaps = append(llmCaps, llm.CapabilityStreaming, llm.CapabilityText)

		case CapabilityTools:
			llmCaps = append(llmCaps, llm.CapabilityTools)

		case CapabilityEmbedding:
			llmCaps = append(llmCaps, llm.CapabilityEmbedding)
		}
	}

	return llmCaps
}
