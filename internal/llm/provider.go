package llm

import (
	"context"

	"github.com/go-playground/validator/v10"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

var validate = validator.New()

// Info describes a driver instance for display and configuration purposes:
// its identity (Key, Name, Description, Icon, Tags) and the JSON Schema
// (ConfigurationSchema) that validates the config map passed to the driver.
// Key is the registry identity for the driver (see R.Register) and must be
// set by whoever builds the driver (e.g. via a CreateProvider's WithKey
// option); it is never derived or overwritten by the registry.
type Info struct {
	Key                 string        `json:"key" validate:"required"`
	Name                string        `json:"name" validate:"required"`
	Description         string        `json:"description" validate:"required"`
	Icon                string        `json:"icon" validate:"omitempty"`
	Tags                []string      `json:"tags" validate:"omitempty"`
	ConfigurationSchema jsonx.JSONMap `json:"configuration_schema"`
}

// Validate checks that Info's required fields (Key, Name, Description) are
// set. It only validates the metadata shape; it says nothing about whether
// the driver's behavior (e.g. its API funcs) is complete — see IDriver.Validate.
func (i Info) Validate() error {
	return validate.Struct(i)
}

// GenerateOptions carries the per-call inputs to Driver.Generate and
// Driver.Stream: the Prompt to send and the Tools the model may call.
type GenerateOptions struct {
	Prompt Prompt
}

// GenerateResult is the output of Driver.Generate.
type GenerateResult struct {
	Text string
}

type IProvider interface {
	Info() Info
	TestConnection(ctx context.Context, config jsonx.JSONMap) error
	Validate() error

	Stream(ctx context.Context, config jsonx.JSONMap, options GenerateOptions) (StreamIterator, error)
	Generate(ctx context.Context, config jsonx.JSONMap, options GenerateOptions) (GenerateResult, error)

	Models(ctx context.Context, config jsonx.JSONMap) ([]Model, error)
	Model(ctx context.Context, config jsonx.JSONMap) (Model, error)
}
