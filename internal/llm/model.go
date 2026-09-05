package llm

import (
	"context"
	"slices"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

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

// ModelLoader lists a provider's model catalog. Both funcs are optional —
// a provider without one returns ErrModelLoaderNotConfigured (see
// llmProvider.Models/Model).
type ModelLoader struct {
	Models func(ctx context.Context, authConfig jsonx.JSONMap) ([]Model, error)
	Model  func(ctx context.Context, authConfig jsonx.JSONMap) (Model, error)
}
