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
func (r *Registry) List() []Provider {
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Provider, 0, len(r.providers))
	for _, p := range r.providers {
		out = append(out, p)
	}
	slices.SortFunc(out, func(a, b Provider) int {
		return strings.Compare(a.Info().Key, b.Info().Key)
	})
	return out
}

// Connect resolves the provider for key, checks the auth options against the
// provider's declared Auth methods, and — when the provider is a
// HealthChecker — runs its health check. It returns the ready provider.
func (r *Registry) Connect(ctx context.Context, key string, authOptions jsonx.JSONMap) (Provider, error) {
	p, ok := r.get(key)
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrProviderNotFound, key)
	}
	if err := validateAuthOptions(p.Info().Auth, authOptions); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAuth, err)
	}
	if hc, ok := p.(HealthChecker); ok {
		if err := hc.HealthCheck(ctx, authOptions); err != nil {
			return nil, err
		}
	}
	return p, nil
}

// Models returns the provider's model list, served from the cache keyed by
// provider key + a hash of authOptions. Concurrent misses for the same key
// collapse into a single provider call.
func (r *Registry) Models(ctx context.Context, key string, authOptions jsonx.JSONMap) ([]Model, error) {
	p, ok := r.get(key)
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrProviderNotFound, key)
	}

	cacheKey := modelsCacheKey(key, authOptions)
	if models, ok := cache.GetAs[[]Model](r.modelsCache, cacheKey); ok {
		return models, nil
	}

	v, err, _ := r.modelsGroup.Do(cacheKey, func() (any, error) {
		if models, ok := cache.GetAs[[]Model](r.modelsCache, cacheKey); ok {
			return models, nil
		}
		models, err := p.Models(ctx, authOptions)
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
func (r *Registry) HasModel(ctx context.Context, providerKey, modelKey string, authOptions jsonx.JSONMap) (bool, error) {
	models, err := r.Models(ctx, providerKey, authOptions)
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
// auth-option hash.
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

// validateAuthOptions passes if any of the provider's declared auth methods
// accepts authOptions: a no-auth method always passes; a static method passes
// when authOptions satisfies its JSON Schema. A provider that declares no auth
// method has no requirement.
func validateAuthOptions(methods []Auth, authOptions jsonx.JSONMap) error {
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
			if err := jsonschema.Validate(m.Data, authOptions); err != nil {
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
// of the auth options — different credentials or tiers can expose different
// model lists.
func modelsCacheKey(providerKey string, authOptions jsonx.JSONMap) string {
	return modelsCachePrefix + providerKey + "\x00" + hashAuthOptions(authOptions)
}

// hashAuthOptions returns a stable hex SHA-256 of authOptions. encoding/json
// sorts map keys, so the digest is deterministic for equal maps.
func hashAuthOptions(authOptions jsonx.JSONMap) string {
	if len(authOptions) == 0 {
		return "none"
	}
	b, err := json.Marshal(authOptions)
	if err != nil {
		return fmt.Sprintf("unhashable-%d", len(authOptions))
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
