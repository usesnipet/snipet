package llm

import "slices"

// Capability is a single feature a Model supports. A model carries a set of
// them so callers can filter or route a request (e.g. "needs vision").
type Capability string

const (
	CapabilityText      Capability = "text"      // text output
	CapabilityVision    Capability = "vision"    // accepts image input
	CapabilityTools     Capability = "tools"     // tool / function calling
	CapabilityStreaming Capability = "streaming" // supports Provider.Stream
)

// Model is one entry in a provider's catalog (see Provider.Models).
type Model struct {
	Key          string       `json:"key"` // Unique identifier for model (eg. gpt-4o)
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	Capabilities []Capability `json:"capabilities"`

	// ContextWindow is the maximum input size in tokens; 0 means unspecified.
	ContextWindow int `json:"context_window"`
	// MaxOutputTokens caps the generated tokens; 0 means unspecified.
	MaxOutputTokens int `json:"max_output_tokens,omitempty"`
}

// HasCapability reports whether the model lists c among its capabilities.
func (m Model) HasCapability(c Capability) bool {
	return slices.Contains(m.Capabilities, c)
}
