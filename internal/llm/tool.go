package llm

import "github.com/usesnipet/snipet/pkg/jsonx"

// Tool is a tool / function definition offered to the model. The provider
// maps it to its own tool-calling format.
type Tool struct {
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Parameters  jsonx.JSONMap `json:"parameters"` // JSON Schema for the arguments
}
