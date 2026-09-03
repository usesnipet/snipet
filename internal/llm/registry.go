package llm

import (
	"fmt"
	"maps"
	"slices"
	"sync"

	"github.com/usesnipet/snipet/internal/logger"
)

// Registry is a concurrency-safe registry of provider instances, keyed by their own
// Info().Key rather than a name supplied by the caller — a provider declares
// its own identity, the registry just holds it.
type Registry struct {
	log   *logger.Logger
	mu    sync.RWMutex
	items map[string]IProvider
}

func NewRegistry(log *logger.Logger) *Registry {
	return &Registry{
		log:   log,
		items: make(map[string]IProvider),
	}
}

// Register validates value (see IProvider.Validate) and adds it under its own
// Info().Key. It fails if value is invalid or its key is already taken —
// this is the boundary every provider must clear to enter the registry,
// regardless of how it was constructed.
func (r *Registry) Register(value IProvider, err error) error {
	if err != nil {
		r.log.Errorf("provider: skip register: %v", err)
		return err
	}

	if err := value.Validate(); err != nil {
		err = fmt.Errorf("invalid provider: %w", err)
		r.log.Errorf("provider: skip register: %v", err)
		return err
	}

	key := value.Info().Key

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.items[key]; exists {
		err := fmt.Errorf("%q already registered", key)
		r.log.Errorf("provider: skip register: %v", err)
		return err
	}

	r.items[key] = value
	return nil
}

func (r *Registry) MustRegister(value IProvider, err error) {
	if err := r.Register(value, err); err != nil {
		panic(err)
	}
}

func (r *Registry) Get(name string) (IProvider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	value, ok := r.items[name]
	return value, ok
}

func (r *Registry) MustGet(name string) IProvider {
	value, ok := r.Get(name)
	if !ok {
		panic(fmt.Sprintf("registry: %q not found", name))
	}
	return value
}

func (r *Registry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	_, ok := r.items[name]
	return ok
}

func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := slices.Collect(maps.Keys(r.items))
	slices.Sort(names)

	return names
}
