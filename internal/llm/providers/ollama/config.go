package ollama

import (
	"fmt"

	"github.com/usesnipet/snipet/internal/llm"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Config is the typed, defaulted view of the "config" section of an Ollama
// connection options map.
type Config struct {
	BaseURL string `json:"base_url"`
}

// ConnectionOptions is the typed, defaulted connection options for a call
// against an Ollama server.
type ConnectionOptions struct {
	Config Config `json:"config"`
}

// toOllamaConnectionOptions validates connectionOptions' config section
// against info.Schemas.Config, filling in any field missing from it with the
// schema's "default" (base_url falls back to a local server this way — see
// schema/config.json — so callers don't have to specify it), and decodes the
// result into ConnectionOptions.
func toOllamaConnectionOptions(info llm.Info, connectionOptions jsonx.JSONMap) (ConnectionOptions, error) {
	config, err := jsonschema.ParseAndValidate[Config](info.Schemas.Config, llm.ConfigSection(connectionOptions))
	if err != nil {
		return ConnectionOptions{}, fmt.Errorf("%w: %v", llm.ErrInvalidOptions, err)
	}
	return ConnectionOptions{Config: *config}, nil
}
