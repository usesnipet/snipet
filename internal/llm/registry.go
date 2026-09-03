package llm

import (
	"fmt"
	"maps"
	"slices"
	"sync"

	"github.com/usesnipet/snipet/internal/logger"
)

// Registry is a concurrency-safe registry of driver instances, keyed by their own
// Info().Key rather than a name supplied by the caller — a driver declares
// its own identity, the registry just holds it.
type Registry[T IProvider] struct {
	log   *logger.Logger
	mu    sync.RWMutex
	items map[string]T
}

func NewRegistry[T IProvider](log *logger.Logger) *Registry[T] {
	return &Registry[T]{
		log:   log,
		items: make(map[string]T),
	}
}

// Register validates value (see IProvider.Validate) and adds it under its own
// Info().Key. It fails if value is invalid or its key is already taken —
// this is the boundary every driver must clear to enter the registry,
// regardless of how it was constructed.
func (r *Registry[T]) Register(value T, err error) error {
	if err != nil {
		r.log.Errorf("driver: skip register: %v", err)
		return err
	}

	if err := value.Validate(); err != nil {
		err = fmt.Errorf("invalid driver: %w", err)
		r.log.Errorf("driver: skip register: %v", err)
		return err
	}

	key := value.Info().Key

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.items[key]; exists {
		err := fmt.Errorf("%q already registered", key)
		r.log.Errorf("driver: skip register: %v", err)
		return err
	}

	r.items[key] = value
	return nil
}

func (r *Registry[T]) MustRegister(value T, err error) {
	if err := r.Register(value, err); err != nil {
		panic(err)
	}
}

func (r *Registry[T]) Get(name string) (T, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	value, ok := r.items[name]
	return value, ok
}

func (r *Registry[T]) MustGet(name string) T {
	value, ok := r.Get(name)
	if !ok {
		panic(fmt.Sprintf("registry: %q not found", name))
	}
	return value
}

func (r *Registry[T]) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	_, ok := r.items[name]
	return ok
}

func (r *Registry[T]) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := slices.Collect(maps.Keys(r.items))
	slices.Sort(names)

	return names
}
