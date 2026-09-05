package llm

import "errors"

var (
	// ErrTestConnectionNotConfigured is returned by TestConnection when the
	// provider was built without API.TestConnection.
	ErrTestConnectionNotConfigured = errors.New("test connection not configured")
	// ErrModelLoaderNotConfigured is returned by Models/Model when the provider
	// was built without WithModelLoader.
	ErrModelLoaderNotConfigured = errors.New("model loader not configured")
	// ErrGenerateNotConfigured is returned by Generate when the provider was
	// built without API.Generate.
	ErrGenerateNotConfigured = errors.New("generate not configured")
	// ErrStreamNotConfigured is returned by Stream when the provider was built
	// without API.Stream.
	ErrStreamNotConfigured = errors.New("stream not configured")
	// ErrNoActionConfigured is returned by Validate when a provider has no
	// action configured at all (e.g. neither API.Generate nor API.Stream).
	ErrNoActionConfigured = errors.New("no action configured")

	// ErrModelNotFound is returned by ModelLoader.Model when no model
	// matches the requested config.
	ErrModelNotFound = errors.New("model not found")
)
