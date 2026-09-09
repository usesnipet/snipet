package llm_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/internal/infra/cache"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// --- test doubles -----------------------------------------------------------

// baseProvider implements llm.Provider + llm.Generator.
type baseProvider struct {
	info      llm.Info
	models    []llm.Model
	modelsFn  func(ctx context.Context) ([]llm.Model, error)
	delay     time.Duration
	callCount *atomic.Int32
}

func (p *baseProvider) Info() llm.Info { return p.info }

func (p *baseProvider) Models(ctx context.Context, _ jsonx.JSONMap) ([]llm.Model, error) {
	if p.callCount != nil {
		p.callCount.Add(1)
	}
	if p.delay > 0 {
		select {
		case <-time.After(p.delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	if p.modelsFn != nil {
		return p.modelsFn(ctx)
	}
	return p.models, nil
}

func (p *baseProvider) Generate(context.Context, llm.GenerateRequest) (llm.Response, error) {
	return llm.Response{}, nil
}

// healthProvider adds llm.HealthChecker to baseProvider.
type healthProvider struct {
	*baseProvider
	healthErr error
}

func (p *healthProvider) HealthCheck(context.Context, jsonx.JSONMap) error { return p.healthErr }

// streamerOnlyProvider implements llm.Provider + llm.Streamer (no Generator).
type streamerOnlyProvider struct{ key string }

func (p streamerOnlyProvider) Info() llm.Info { return llm.Info{Key: p.key} }
func (p streamerOnlyProvider) Models(context.Context, jsonx.JSONMap) ([]llm.Model, error) {
	return nil, nil
}
func (p streamerOnlyProvider) Stream(context.Context, llm.GenerateRequest) (llm.StreamIterator, error) {
	return nil, nil
}

// modelsOnlyProvider implements only llm.Provider — no action capability.
type modelsOnlyProvider struct{ key string }

func (p modelsOnlyProvider) Info() llm.Info { return llm.Info{Key: p.key} }
func (p modelsOnlyProvider) Models(context.Context, jsonx.JSONMap) ([]llm.Model, error) {
	return nil, nil
}

// --- helpers --------------------------------------------------------------

func newRegistry() *llm.Registry {
	return llm.NewRegistry(cache.NewMemoryCache(0, 0), time.Minute)
}

func provider(key string, models ...llm.Model) *baseProvider {
	return &baseProvider{info: llm.Info{Key: key}, models: models}
}

func staticAuthSchema() jsonx.JSONMap {
	return jsonx.JSONMap{
		"type":     "object",
		"required": []any{"api_key"},
		"properties": jsonx.JSONMap{
			"api_key": jsonx.JSONMap{"type": "string"},
		},
	}
}

// --- Register -----------------------------------------------------------

func TestRegister_OK(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	require.NoError(t, r.Register(provider("openai")))
	assert.True(t, r.Has("openai"))
}

func TestRegister_EmptyKey(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	assert.Error(t, r.Register(provider("")))
}

func TestRegister_Duplicate(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	require.NoError(t, r.Register(provider("openai")))
	assert.Error(t, r.Register(provider("openai")))
}

func TestRegister_RejectsProviderWithoutActionCapability(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	err := r.Register(modelsOnlyProvider{key: "bare"})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "neither Generator nor Streamer")
	assert.False(t, r.Has("bare"))
}

func TestRegister_StreamerOnlyIsAccepted(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	require.NoError(t, r.Register(streamerOnlyProvider{key: "anthropic"}))
	assert.True(t, r.Has("anthropic"))
}

func TestMustRegister_PanicsOnError(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	require.NoError(t, r.Register(provider("openai")))

	assert.Panics(t, func() { r.MustRegister(provider("openai")) })
}

// --- Has / List -------------------------------------------------------

func TestHas(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	require.NoError(t, r.Register(provider("openai")))

	assert.True(t, r.Has("openai"))
	assert.False(t, r.Has("gemini"))
}

func TestList_OrderedByKey(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	require.NoError(t, r.Register(provider("zeta")))
	require.NoError(t, r.Register(provider("alpha")))
	require.NoError(t, r.Register(provider("mid")))

	keys := make([]string, 0, 3)
	for _, p := range r.List() {
		keys = append(keys, p.Key)
	}

	assert.Equal(t, []string{"alpha", "mid", "zeta"}, keys)
}

// --- Models: cache + single-flight ------------------------------------

func TestModels_ServedFromCache(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	var calls atomic.Int32
	p := &baseProvider{
		info:      llm.Info{Key: "openai"},
		models:    []llm.Model{{Key: "gpt-4o"}},
		callCount: &calls,
	}
	require.NoError(t, r.Register(p))

	for range 5 {
		got, err := r.Models(context.Background(), "openai", nil)
		require.NoError(t, err)
		assert.Equal(t, []llm.Model{{Key: "gpt-4o"}}, got)
	}

	assert.Equal(t, int32(1), calls.Load())
}

func TestModels_ConcurrentMissesCollapse(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	var calls atomic.Int32
	p := &baseProvider{
		info:      llm.Info{Key: "openai"},
		models:    []llm.Model{{Key: "gpt-4o"}},
		delay:     40 * time.Millisecond,
		callCount: &calls,
	}
	require.NoError(t, r.Register(p))

	const n = 25
	var wg sync.WaitGroup
	errs := make([]error, n)
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, errs[i] = r.Models(context.Background(), "openai", nil)
		}()
	}
	wg.Wait()

	for _, err := range errs {
		assert.NoError(t, err)
	}
	assert.Equal(t, int32(1), calls.Load())
}

func TestModels_AuthOptionsKeyTheCacheSeparately(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	var calls atomic.Int32
	p := &baseProvider{
		info:      llm.Info{Key: "openai"},
		models:    []llm.Model{{Key: "gpt-4o"}},
		callCount: &calls,
	}
	require.NoError(t, r.Register(p))

	authA := jsonx.JSONMap{"api_key": "aaa"}
	authB := jsonx.JSONMap{"api_key": "bbb"}

	_, _ = r.Models(context.Background(), "openai", authA)
	_, _ = r.Models(context.Background(), "openai", authA) // cache hit
	_, _ = r.Models(context.Background(), "openai", authB) // miss: different auth

	assert.Equal(t, int32(2), calls.Load())
}

func TestModels_ErrorIsNotCached(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	var calls atomic.Int32
	p := &baseProvider{
		info:      llm.Info{Key: "openai"},
		callCount: &calls,
		modelsFn: func(context.Context) ([]llm.Model, error) {
			if calls.Load() == 1 {
				return nil, errors.New("boom")
			}
			return []llm.Model{{Key: "gpt-4o"}}, nil
		},
	}
	require.NoError(t, r.Register(p))

	_, err := r.Models(context.Background(), "openai", nil)
	require.Error(t, err)

	got, err := r.Models(context.Background(), "openai", nil)
	require.NoError(t, err)
	assert.Equal(t, []llm.Model{{Key: "gpt-4o"}}, got)
	assert.Equal(t, int32(2), calls.Load())
}

func TestModels_ProviderNotFound(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	_, err := r.Models(context.Background(), "ghost", nil)

	assert.ErrorIs(t, err, llm.ErrProviderNotFound)
}

// --- HasModel -------------------------------------------------------

func TestHasModel(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	require.NoError(t, r.Register(provider("openai", llm.Model{Key: "gpt-4o"}, llm.Model{Key: "gpt-4o-mini"})))

	has, err := r.HasModel(context.Background(), "openai", "gpt-4o-mini", nil)
	require.NoError(t, err)
	assert.True(t, has)

	has, err = r.HasModel(context.Background(), "openai", "gpt-5", nil)
	require.NoError(t, err)
	assert.False(t, has)
}

func TestHasModel_PropagatesProviderError(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	p := &baseProvider{
		info: llm.Info{Key: "openai"},
		modelsFn: func(context.Context) ([]llm.Model, error) {
			return nil, errors.New("upstream down")
		},
	}
	require.NoError(t, r.Register(p))

	_, err := r.HasModel(context.Background(), "openai", "gpt-4o", nil)

	assert.Error(t, err)
}

// --- InvalidateModels ---------------------------------------------

func TestInvalidateModels_ForcesRefetchForThatProviderOnly(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	var callsA, callsB atomic.Int32
	pa := &baseProvider{info: llm.Info{Key: "a"}, models: []llm.Model{{Key: "m"}}, callCount: &callsA}
	pb := &baseProvider{info: llm.Info{Key: "b"}, models: []llm.Model{{Key: "m"}}, callCount: &callsB}
	require.NoError(t, r.Register(pa))
	require.NoError(t, r.Register(pb))

	_, _ = r.Models(context.Background(), "a", nil)
	_, _ = r.Models(context.Background(), "b", nil)

	r.InvalidateModels("a")

	_, _ = r.Models(context.Background(), "a", nil) // refetch
	_, _ = r.Models(context.Background(), "b", nil) // still cached

	assert.Equal(t, int32(2), callsA.Load())
	assert.Equal(t, int32(1), callsB.Load())
}

// --- Connect -----------------------------------------------------

func TestConnect_ProviderNotFound(t *testing.T) {
	t.Parallel()
	r := newRegistry()

	_, err := r.Connect(context.Background(), "ghost", nil)

	assert.ErrorIs(t, err, llm.ErrProviderNotFound)
}

func TestConnect_NoAuthMethodDeclared(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	require.NoError(t, r.Register(provider("openai")))

	got, err := r.Connect(context.Background(), "openai", nil)

	require.NoError(t, err)
	assert.Equal(t, "openai", got.Info().Key)
}

func TestConnect_NoAuthType(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	p := provider("local")
	p.info.Auth = []llm.Auth{{Type: llm.AuthTypeNone}}
	require.NoError(t, r.Register(p))

	_, err := r.Connect(context.Background(), "local", nil)

	assert.NoError(t, err)
}

func TestConnect_StaticAuth_Valid(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	p := provider("openai")
	p.info.Auth = []llm.Auth{{Type: llm.AuthTypeStatic, Data: staticAuthSchema()}}
	require.NoError(t, r.Register(p))

	_, err := r.Connect(context.Background(), "openai", jsonx.JSONMap{"api_key": "sk-123"})

	assert.NoError(t, err)
}

func TestConnect_StaticAuth_Invalid(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	p := provider("openai")
	p.info.Auth = []llm.Auth{{Type: llm.AuthTypeStatic, Data: staticAuthSchema()}}
	require.NoError(t, r.Register(p))

	_, err := r.Connect(context.Background(), "openai", jsonx.JSONMap{"wrong": "field"})

	assert.ErrorIs(t, err, llm.ErrAuth)
}

func TestConnect_StaticAuth_FallsBackToNoAuthMethod(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	p := provider("openai")
	p.info.Auth = []llm.Auth{
		{Type: llm.AuthTypeStatic, Data: staticAuthSchema()},
		{Type: llm.AuthTypeNone},
	}
	require.NoError(t, r.Register(p))

	_, err := r.Connect(context.Background(), "openai", jsonx.JSONMap{"wrong": "field"})

	assert.NoError(t, err)
}

func TestConnect_RunsHealthCheck(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	p := &healthProvider{
		baseProvider: &baseProvider{info: llm.Info{Key: "openai"}},
		healthErr:    errors.New("cannot reach api"),
	}
	require.NoError(t, r.Register(p))

	_, err := r.Connect(context.Background(), "openai", nil)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot reach api")
}

func TestConnect_HealthCheckOK(t *testing.T) {
	t.Parallel()
	r := newRegistry()
	p := &healthProvider{baseProvider: &baseProvider{info: llm.Info{Key: "openai"}}}
	require.NoError(t, r.Register(p))

	_, err := r.Connect(context.Background(), "openai", nil)

	assert.NoError(t, err)
}
