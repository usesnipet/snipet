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

	// ErrModelNotFound is returned by ModelLoader.Model when no model
	// matches the requested config.
	ErrModelNotFound = errors.New("model not found")

	ErrProviderNotFound = errors.New("provider not found")

	ErrProviderConnectionFailed = errors.New("provider connection failed")
)
