package registry

import (
	"context"
	"errors"
	"fmt"

	"github.com/usesnipet/snipet/internal/llm"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

var (
	ErrProviderNotFound         = errors.New("provider not found")
	ErrProviderConnectionFailed = errors.New("provider connection failed")
)

// Manager is a thin facade over a Registry that adds the runtime-facing
// concerns the bare registry doesn't handle: validating a config map
// against a provider's schemas, and dialing a provider to confirm the
// config actually connects (see Connect).
type Manager struct {
	registry *Registry
}

func NewManager(registry *Registry) *Manager {
	return &Manager{registry: registry}
}

func (m *Manager) GetProvider(key string) (llm.IProvider, error) {
	providerInstance, ok := m.registry.Get(key)
	if !ok {
		return providerInstance, ErrProviderNotFound
	}
	return providerInstance, nil
}

// Names returns the sorted keys of every registered provider.
func (m *Manager) Names() []string {
	return m.registry.Names()
}

// ValidateConfiguration checks config against a provider's auth and generate
// JSON Schemas. Both schemas validate the same config map — a provider's
// config is one flat map with auth and generation fields as siblings (e.g.
// api_key and model), and each schema only asserts its own concern (via its
// own "required" list) rather than the whole shape, so this works without
// needing the map itself split in two.
func (m *Manager) ValidateConfiguration(schemas llm.Schemas, config jsonx.JSONMap) error {
	if err := jsonschema.Validate(schemas.Auth, config); err != nil {
		return err
	}
	return jsonschema.Validate(schemas.Generate, config)
}

// ValidateConfigurationByKey looks up the provider by key and validates config
// against its schemas.
func (m *Manager) ValidateConfigurationByKey(key string, config jsonx.JSONMap) error {
	providerInstance, err := m.GetProvider(key)
	if err != nil {
		return err
	}
	return m.ValidateConfiguration(providerInstance.Info().Schemas, config)
}

// Connect resolves the provider by key, validates config against its schemas
// and runs its connectivity check, returning the ready-to-use provider
// instance. config is passed as both the auth and generate config since a
// connection today keeps them in one map (see ValidateConfiguration).
func (m *Manager) Connect(ctx context.Context, providerKey string, config jsonx.JSONMap) (llm.IProvider, error) {
	providerInstance, err := m.GetProvider(providerKey)
	if err != nil {
		return providerInstance, err
	}
	if err := m.ValidateConfiguration(providerInstance.Info().Schemas, config); err != nil {
		return providerInstance, err
	}
	options := llm.TestConnectionOptions{AuthConfig: config, GenerateConfig: config}
	if err := providerInstance.TestConnection(ctx, options); err != nil {
		return providerInstance, fmt.Errorf("%w: %v", ErrProviderConnectionFailed, err)
	}
	return providerInstance, nil
}

// ListProviders returns the Info of every registered provider, sorted by key.
func (m *Manager) ListProviders(ctx context.Context) ([]llm.Info, error) {
	names := m.registry.Names()
	providers := make([]llm.Info, 0, len(names))

	for _, name := range names {
		providerInstance, err := m.GetProvider(name)
		if err != nil {
			return nil, err
		}
		providers = append(providers, providerInstance.Info())
	}

	return providers, nil
}
