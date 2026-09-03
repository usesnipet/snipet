package llm

import (
	"context"
	"fmt"

	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Manager is a thin facade over a provider.Registry that adds the
// runtime-facing concerns the bare registry doesn't handle: validating a
// config map against a provider's schema, and dialing a provider to confirm the
// config actually connects (see Connect).
type Manager struct {
	registry *Registry
}

func NewManager(registry *Registry) *Manager {
	return &Manager{registry: registry}
}

func (m *Manager) GetProvider(key string) (IProvider, error) {
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

// ValidateConfiguration checks config against a provider's JSON Schema.
func (m *Manager) ValidateConfiguration(schema jsonx.JSONMap, config jsonx.JSONMap) error {
	return jsonschema.Validate(schema, config)
}

// ValidateConfigurationByKey looks up the provider by key and validates config
// against its schema.
func (m *Manager) ValidateConfigurationByKey(key string, config jsonx.JSONMap) error {
	providerInstance, err := m.GetProvider(key)
	if err != nil {
		return err
	}
	return m.ValidateConfiguration(providerInstance.Info().ConfigurationSchema, config)
}

// Connect resolves the provider by key, validates config against its schema and
// runs its connectivity check, returning the ready-to-use provider instance.
func (m *Manager) Connect(ctx context.Context, providerKey string, config jsonx.JSONMap) (IProvider, error) {
	providerInstance, err := m.GetProvider(providerKey)
	if err != nil {
		return providerInstance, err
	}
	if err := m.ValidateConfiguration(providerInstance.Info().ConfigurationSchema, config); err != nil {
		return providerInstance, err
	}
	if err := providerInstance.TestConnection(ctx, config); err != nil {
		return providerInstance, fmt.Errorf("%w: %v", ErrProviderConnectionFailed, err)
	}
	return providerInstance, nil
}

// ListProviders returns the Info of every registered provider, sorted by key.
func (m *Manager) ListProviders(ctx context.Context) ([]Info, error) {
	names := m.registry.Names()
	providers := make([]Info, 0, len(names))

	for _, name := range names {
		providerInstance, err := m.GetProvider(name)
		if err != nil {
			return nil, err
		}
		providers = append(providers, providerInstance.Info())
	}

	return providers, nil
}
