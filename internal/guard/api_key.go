package guard

import (
	"context"
	"net/http"
	"time"

	"github.com/usesnipet/snipet/internal/api"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/infra/cache"
	apikey "github.com/usesnipet/snipet/internal/module/api-key"
)

// cachedAPIKey is what RequireApiKey caches per raw key — just enough to
// rebuild an auth.ApiKeyIdentity on a cache hit without re-verifying.
type cachedAPIKey struct {
	ID string
}

// RequireApiKey requires a valid X-API-Key header and sets an
// auth.ApiKeyIdentity.
func RequireApiKey(apiKeyService *apikey.Service, apiKeyCache cache.ICache) api.Gate {
	return func(r *http.Request) (context.Context, error) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			return nil, apperr.Unauthorized("api key not provided")
		}

		if cached, found := cache.GetAs[cachedAPIKey](apiKeyCache, key); found {
			return auth.SetApiKeyIdentity(r.Context(), auth.ApiKeyIdentity{APIKeyID: cached.ID}), nil
		}

		found, err := apiKeyService.VerifyAPIKey(r.Context(), key)
		if err != nil {
			return nil, err
		}
		apiKeyCache.Set(key, cachedAPIKey{ID: found.ID}, cache.WithTTL(1*time.Minute))

		return auth.SetApiKeyIdentity(r.Context(), auth.ApiKeyIdentity{APIKeyID: found.ID}), nil
	}
}
