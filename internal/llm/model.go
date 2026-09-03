package llm

import "slices"

type ModelCapabilities string

const (
	ModelCapabilitiesToolCall  ModelCapabilities = "toolCall"
	ModelCapabilitiesStreaming ModelCapabilities = "streaming"
)

type Model struct {
	Name         string
	Description  string
	Capabilities []ModelCapabilities
}

func NewModel(name string, description string, capabilities []ModelCapabilities) Model {
	return Model{
		Name:         name,
		Description:  description,
		Capabilities: capabilities,
	}
}

func (m Model) Can(capability ModelCapabilities) bool {
	return slices.Contains(m.Capabilities, capability)
}
