package llm

import "github.com/usesnipet/snipet/pkg/jsonx"

// Option configures a Provider created via CreateProvider.
type Option func(*llmProvider)

// CreateProvider builds a Provider from the given Options. Key, TestConnection,
// and at least one of Stream/Generate (set via WithAPI) are required;
// CreateProvider returns an error instead of a Provider if any of them is
// missing, so a misconfigured provider never gets registered. WithModelLoader
// is optional.
func CreateProvider(opts ...Option) (IProvider, error) {
	d := &llmProvider{}
	for _, opt := range opts {
		opt(d)
	}

	if err := d.Validate(); err != nil {
		return nil, err
	}

	return d, nil
}

func WithInfo(info Info) Option {
	return func(o *llmProvider) {
		o.info = info
	}
}

// WithKey sets the provider's registry identity (Info.Key). It's
// required — CreateProvider fails without it — since R.Register derives the
// provider's registry key from it.
func WithKey(key string) Option {
	return func(o *llmProvider) {
		o.info.Key = key
	}
}

// WithName sets the provider's display name (Info.Name).
func WithName(name string) Option {
	return func(o *llmProvider) {
		o.info.Name = name
	}
}

// WithAPI sets the provider's API.
func WithAPI(api API) Option {
	return func(o *llmProvider) {
		o.api = api
	}
}

// WithDescription sets the provider's human-readable description.
func WithDescription(description string) Option {
	return func(o *llmProvider) {
		o.info.Description = description
	}
}

// WithIcon sets the provider's display icon.
func WithIcon(icon string) Option {
	return func(o *llmProvider) {
		o.info.Icon = icon
	}
}

// WithTags sets the provider's classification tags.
func WithTags(tags ...string) Option {
	return func(o *llmProvider) {
		o.info.Tags = tags
	}
}

// WithAuthConfigSchema sets the JSON Schema (as a jsonx.JSONMap) used to
// validate the authentication part of a provider's config (e.g. api_key,
// endpoint). Build it from a JSON document with LoadSchema/MustLoadSchema.
func WithAuthConfigSchema(schema jsonx.JSONMap) Option {
	return func(o *llmProvider) {
		o.info.Schemas.Auth = schema
	}
}

// WithGenerateConfigSchema sets the JSON Schema used to validate the
// text-generation part of a provider's config (e.g. model, temperature).
func WithGenerateConfigSchema(schema jsonx.JSONMap) Option {
	return func(o *llmProvider) {
		o.info.Schemas.Generate = schema
	}
}

func WithModelLoader(modelLoader ModelLoader) Option {
	return func(o *llmProvider) {
		o.modelLoader = modelLoader
	}
}
