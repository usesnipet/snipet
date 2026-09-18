package auth

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
)

// BasicIdentity is the operator authenticated via HTTP Basic Auth against
// the single admin credential configured by env vars, set by
// guard.RequireBasicAuth.
type BasicIdentity struct {
	Username string
}

type basicIdentityKeyType struct{}

var basicIdentityKey = basicIdentityKeyType{}

// SetBasicIdentity stores the authenticated BasicIdentity on ctx.
func SetBasicIdentity(ctx context.Context, identity BasicIdentity) context.Context {
	return context.WithValue(ctx, basicIdentityKey, identity)
}

// CurrentBasic returns the BasicIdentity loaded by guard.RequireBasicAuth
// for this request.
func CurrentBasic(ctx context.Context) (BasicIdentity, error) {
	identity, ok := ctx.Value(basicIdentityKey).(BasicIdentity)
	if !ok || identity.Username == "" {
		return BasicIdentity{}, apperr.Unauthorized("unauthorized")
	}
	return identity, nil
}
