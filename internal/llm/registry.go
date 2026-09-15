package llm

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/usesnipet/snipet/internal/infra/cache"
	jsonschema "github.com/usesnipet/snipet/pkg/json_schema"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// modelsCachePrefix namespaces this package's entries in a (possibly shared)
// cache.ICache.
const modelsCachePrefix = "llm:models:"

// Registry is the catalog of llm providers. Providers are registered once at
// startup and looked up by key thereafter. Each provider's model list is
// cached in the injected cache.ICache, keyed by provider key plus a hash of
// the auth options, with single-flight so concurrent misses collapse into one
// provider call.
type Registry struct {
	mu        sync.RWMutex
	providers map[string]Provider

	modelsCache cache.ICache
	modelsTTL   time.Duration
	modelsGroup singleflight.Group
}

// NewRegistry builds an empty Registry. modelsCache stores provider model
// lists; modelsTTL is how long an entry stays fresh (0 = no expiry).
func NewRegistry(modelsCache cache.ICache, modelsTTL time.Duration) *Registry {
	return &Registry{
		providers:   make(map[string]Provider),
		modelsCache: modelsCache,
		modelsTTL:   modelsTTL,
	}
}

// Register adds p under its Info().Key. It fails if the key is empty, already
// taken, or the provider implements neither Generator nor Streamer.
func (r *Registry) Register(p Provider) error {
	key := p.Info().Key
	if key == "" {
		return fmt.Errorf("llm: provider has no key")
	}
	_, isGenerator := p.(Generator)
	_, isStreamer := p.(Streamer)
	if !isGenerator && !isStreamer {
		return fmt.Errorf("llm: provider %q implements neither Generator nor Streamer", key)
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.providers[key]; exists {
		return fmt.Errorf("llm: provider %q already registered", key)
	}
	r.providers[key] = p
	return nil
}

// MustRegister is Register that panics on error, for startup wiring.
func (r *Registry) MustRegister(p Provider) {
	if err := r.Register(p); err != nil {
		panic(err)
	}
}

// Has reports whether a provider is registered under key.
func (r *Registry) Has(key string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.providers[key]
	return ok
}

// List returns every registered provider, ordered by key.
func (r *Registry) List() []Info {
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Info, 0, len(r.providers))
	for _, p := range r.providers {
		out = append(out, p.Info())
	}
	slices.SortFunc(out, func(a, b Info) int {
		return strings.Compare(a.Key, b.Key)
	})
	return out
}

// Connect resolves the provider for key, validates the connection options
// (auth section against the declared Auth methods, config section against
// Schemas.Config), and — when the provider is a HealthChecker — runs its
// health check. It returns the ready provider.
func (r *Registry) Connect(ctx context.Context, key string, connectionOptions jsonx.JSONMap) (Provider, error) {
	p, ok := r.get(key)
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrProviderNotFound, key)
	}

	info := p.Info()
	if err := validateAuthSection(info.Auth, AuthSection(connectionOptions)); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAuth, err)
	}
	if info.Schemas.Config != nil {
		if _, err := jsonschema.Validate(info.Schemas.Config, ConfigSection(connectionOptions)); err != nil {
			return nil, fmt.Errorf("%w: config: %v", ErrBadRequest, err)
		}
	}

	if hc, ok := p.(HealthChecker); ok {
		if err := hc.HealthCheck(ctx, connectionOptions); err != nil {
			return nil, err
		}
	}
	return p, nil
}

// Models returns the provider's model list, served from the cache keyed by
// provider key + a hash of the connection options. Concurrent misses for the
// same key collapse into a single provider call.
func (r *Registry) Models(ctx context.Context, key string, connectionOptions jsonx.JSONMap) ([]Model, error) {
	p, ok := r.get(key)
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrProviderNotFound, key)
	}

	cacheKey := modelsCacheKey(key, connectionOptions)
	if models, ok := cache.GetAs[[]Model](r.modelsCache, cacheKey); ok {
		return models, nil
	}

	v, err, _ := r.modelsGroup.Do(cacheKey, func() (any, error) {
		if models, ok := cache.GetAs[[]Model](r.modelsCache, cacheKey); ok {
			return models, nil
		}
		models, err := p.Models(ctx, connectionOptions)
		if err != nil {
			return nil, err
		}
		_ = r.modelsCache.Set(cacheKey, models, cache.WithTTL(r.modelsTTL))
		return models, nil
	})
	if err != nil {
		return nil, err
	}
	return v.([]Model), nil
}

// HasModel reports whether the provider under providerKey has a model whose
// Key is modelKey. The model list is resolved through the same cache as Models.
func (r *Registry) HasModel(ctx context.Context, providerKey, modelKey string, connectionOptions jsonx.JSONMap) (bool, error) {
	models, err := r.Models(ctx, providerKey, connectionOptions)
	if err != nil {
		return false, err
	}
	for _, m := range models {
		if m.Key == modelKey {
			return true, nil
		}
	}
	return false, nil
}

// InvalidateModels drops any cached model lists for providerKey, across every
// connection-options hash.
func (r *Registry) InvalidateModels(providerKey string) {
	prefix := modelsCachePrefix + providerKey + "\x00"
	for _, k := range r.modelsCache.Keys() {
		if strings.HasPrefix(k, prefix) {
			_ = r.modelsCache.Delete(k)
		}
	}
}

func (r *Registry) get(key string) (Provider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[key]
	return p, ok
}

// validateAuthSection passes if any of the provider's declared auth methods
// accepts authSection: a no-auth method always passes; a static method passes
// when authSection satisfies its JSON Schema. A provider that declares no auth
// method has no requirement.
func validateAuthSection(methods []Auth, authSection jsonx.JSONMap) error {
	if len(methods) == 0 {
		return nil
	}

	var lastErr error
	for _, m := range methods {
		switch m.Type {
		case AuthTypeNone:
			return nil
		case AuthTypeStatic:
			if m.Data == nil {
				return nil
			}
			if _, err := jsonschema.Validate(m.Data, authSection); err != nil {
				lastErr = err
				continue
			}
			return nil
		default:
			lastErr = fmt.Errorf("unknown auth type %q", m.Type)
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no matching auth method")
	}
	return lastErr
}

// modelsCacheKey combines the namespace prefix, the provider key, and a hash
// of the connection options — different credentials or config can expose
// different model lists.
func modelsCacheKey(providerKey string, connectionOptions jsonx.JSONMap) string {
	return modelsCachePrefix + providerKey + "\x00" + hashConnectionOptions(connectionOptions)
}

// hashConnectionOptions returns a stable hex SHA-256 of connectionOptions.
// encoding/json sorts map keys, so the digest is deterministic for equal maps.
func hashConnectionOptions(connectionOptions jsonx.JSONMap) string {
	if len(connectionOptions) == 0 {
		return "none"
	}
	b, err := json.Marshal(connectionOptions)
	if err != nil {
		return fmt.Sprintf("unhashable-%d", len(connectionOptions))
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
