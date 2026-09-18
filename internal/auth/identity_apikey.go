package auth

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
)

// ApiKeyIdentity is the API key that authenticated the request, set by
// guard.RequireApiKey.
type ApiKeyIdentity struct {
	APIKeyID string
}

type apiKeyIdentityKeyType struct{}

var apiKeyIdentityKey = apiKeyIdentityKeyType{}

// SetApiKeyIdentity stores the authenticated ApiKeyIdentity on ctx.
func SetApiKeyIdentity(ctx context.Context, identity ApiKeyIdentity) context.Context {
	return context.WithValue(ctx, apiKeyIdentityKey, identity)
}

// CurrentApiKey returns the ApiKeyIdentity loaded by guard.RequireApiKey for
// this request.
func CurrentApiKey(ctx context.Context) (ApiKeyIdentity, error) {
	identity, ok := ctx.Value(apiKeyIdentityKey).(ApiKeyIdentity)
	if !ok || identity.APIKeyID == "" {
		return ApiKeyIdentity{}, apperr.Unauthorized("unauthorized")
	}
	return identity, nil
}

// HasApiKey reports whether the request authenticated via an API key.
func HasApiKey(ctx context.Context) bool {
	_, err := CurrentApiKey(ctx)
	return err == nil
}
