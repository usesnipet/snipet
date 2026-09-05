package llm

import (
	"context"

	"github.com/go-playground/validator/v10"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

var validate = validator.New()

// LoadSchema converts a JSON schema document into a jsonx.JSONMap, for use
// with WithAuthConfigSchema/WithGenerateConfigSchema.
func LoadSchema(schemaJSON []byte) (jsonx.JSONMap, error) {
	return jsonschema.Load(schemaJSON)
}

// MustLoadSchema is like LoadSchema but panics on error. Meant for
// package-level vars built from an embedded schema file, where a malformed
// schema is a programming error caught immediately at startup.
func MustLoadSchema(schemaJSON []byte) jsonx.JSONMap {
	schema, err := LoadSchema(schemaJSON)
	if err != nil {
		panic(err)
	}
	return schema
}

// Schemas holds the JSON Schemas that validate a provider's config map: Auth
// for the authentication fields (e.g. api_key, endpoint) and Generate for
// the text-generation fields (e.g. model, temperature). Both schemas
// validate the same flat config map, each checking only its own concern —
// see Manager.ValidateConfiguration.
type Schemas struct {
	Auth     jsonx.JSONMap `json:"auth" validate:"required"`
	Generate jsonx.JSONMap `json:"generate" validate:"required"`
}

// Info describes a provider instance for display and configuration purposes:
// its identity (Key, Name, Description, Icon, Tags) and the JSON Schemas
// that validate the config map passed to the provider. Key is the registry
// identity for the provider (see R.Register) and must be set by whoever
// builds the provider (e.g. via a CreateProvider's WithKey option); it is
// never derived or overwritten by the registry.
type Info struct {
	Key         string   `json:"key" validate:"required"`
	Name        string   `json:"name" validate:"required"`
	Description string   `json:"description" validate:"required"`
	Icon        string   `json:"icon" validate:"omitempty"`
	Tags        []string `json:"tags" validate:"omitempty"`
	Schemas     Schemas  `json:"schemas" validate:"required"`
}

// Validate checks that Info's required fields (Key, Name, Description) are
// set. It only validates the metadata shape; it says nothing about whether
// the provider's behavior (e.g. its API funcs) is complete — see IProvider.Validate.
func (i Info) Validate() error {
	return validate.Struct(i)
}

// TestConnectionOptions carries the per-call inputs to Provider.TestConnection.
type TestConnectionOptions struct {
	AuthConfig     jsonx.JSONMap
	GenerateConfig jsonx.JSONMap
}

// GenerateOptions carries the per-call inputs to Provider.Generate and
// Provider.Stream.
type GenerateOptions struct {
	Messages []Message

	AuthConfig     jsonx.JSONMap
	GenerateConfig jsonx.JSONMap
}

// GenerateResult is the output of Provider.Generate.
type GenerateResult struct {
	Text string
}

// IProvider is what a provider driver implements to plug into the registry.
// TestConnection is required; Generate and Stream are the text-generation
// action and each independently optional (a provider missing one returns a
// "not configured" error — see llmProvider). A future action kind
// (embeddings, images, audio, video, ...) adds its own optional methods here
// following the same shape, without touching the existing ones.
type IProvider interface {
	Info() Info
	TestConnection(ctx context.Context, options TestConnectionOptions) error
	Validate() error

	Generate(ctx context.Context, options GenerateOptions) (GenerateResult, error)
	Stream(ctx context.Context, options GenerateOptions) (StreamIterator, error)

	// Models and Model list a provider's catalog. config is the
	// generate-config map (it identifies a model by name), not the auth
	// config — see ModelLoader.
	Models(ctx context.Context, authConfig jsonx.JSONMap) ([]Model, error)
	Model(ctx context.Context, authConfig jsonx.JSONMap) (Model, error)
}
