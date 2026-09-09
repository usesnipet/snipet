package llm

import "github.com/usesnipet/snipet/pkg/jsonx"

// Info is a provider's static description: its identity, the auth methods it
// accepts, and the JSON Schemas that validate call options.
type Info struct {
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags,omitempty"`

	Auth    []Auth  `json:"auth"`
	Schemas Schemas `json:"schemas"`
}

// AuthType is how a provider authenticates a call.
type AuthType string

const (
	// AuthTypeNone means the provider needs no credentials.
	AuthTypeNone AuthType = "no-auth"
	// AuthTypeStatic means the caller supplies auth options that are
	// validated against Auth.Data (a JSON Schema).
	AuthTypeStatic AuthType = "static"
)

// Auth is one authentication method a provider accepts; a provider may accept
// several. For AuthTypeStatic, Data is the JSON Schema the auth options must
// satisfy.
type Auth struct {
	Type AuthType      `json:"type"`
	Data jsonx.JSONMap `json:"data,omitempty"`
}

// Schemas holds the optional JSON Schemas that validate a call's
// extra_options. A nil schema means the options are unconstrained.
type Schemas struct {
	GenerateExtraOptions jsonx.JSONMap `json:"generate_extra_options,omitempty"`
	StreamExtraOptions   jsonx.JSONMap `json:"stream_extra_options,omitempty"`
}
