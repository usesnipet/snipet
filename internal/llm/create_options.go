package llm

import (
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Option configures a Driver created via CreateProvider.
type Option func(*llmProvider)

func WithInfo(info Info) Option {
	return func(o *llmProvider) {
		o.info = info
	}
}

// WithKey sets the driver's registry identity (Info.Key). It's
// required — CreateProvider fails without it — since R.Register derives the
// driver's registry key from it.
func WithKey(key string) Option {
	return func(o *llmProvider) {
		o.info.Key = key
	}
}

// WithName sets the driver's display name (Info.Name).
func WithName(name string) Option {
	return func(o *llmProvider) {
		o.info.Name = name
	}
}

// WithAPI sets the driver's API.
func WithAPI(api API) Option {
	return func(o *llmProvider) {
		o.api = api
	}
}

// WithDescription sets the driver's human-readable description.
func WithDescription(description string) Option {
	return func(o *llmProvider) {
		o.info.Description = description
	}
}

// WithIcon sets the driver's display icon.
func WithIcon(icon string) Option {
	return func(o *llmProvider) {
		o.info.Icon = icon
	}
}

// WithTags sets the driver's classification tags.
func WithTags(tags ...string) Option {
	return func(o *llmProvider) {
		o.info.Tags = tags
	}
}

// WithConfigurationSchema sets the raw JSON Schema (as a jsonx.JSONMap) used
// to validate config passed to the driver. Prefer ConfigurationSchema or
// MustConfigurationSchema to build this value from a JSON document.
func WithConfigurationSchema(schema jsonx.JSONMap) Option {
	return func(o *llmProvider) {
		o.info.ConfigurationSchema = schema
	}
}

func WithModelLoader(modelLoader ModelLoader) Option {
	return func(o *llmProvider) {
		o.modelLoader = modelLoader
	}
}
