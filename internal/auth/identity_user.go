package auth

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
)

// UserIdentity is the operator authenticated via a JWT issued by the auth
// module — the user-table-backed counterpart to BasicIdentity. It is set on
// the context by the JWT authentication guard (see the Auth guards issue);
// until that guard lands this type + helpers are the stub the users module
// reads its caller from.
type UserIdentity struct {
	ID       string
	Username string
	Role     string
}

// IsAdmin reports whether the identity carries the admin role.
func (u UserIdentity) IsAdmin() bool {
	return u.Role == "admin"
}

type userIdentityKeyType struct{}

var userIdentityKey = userIdentityKeyType{}

// SetUserIdentity stores the authenticated UserIdentity on ctx.
func SetUserIdentity(ctx context.Context, identity UserIdentity) context.Context {
	return context.WithValue(ctx, userIdentityKey, identity)
}

// CurrentUser returns the UserIdentity loaded by the JWT authentication
// guard for this request, or an Unauthorized error when none is present.
func CurrentUser(ctx context.Context) (UserIdentity, error) {
	identity, ok := ctx.Value(userIdentityKey).(UserIdentity)
	if !ok || identity.ID == "" {
		return UserIdentity{}, apperr.Unauthorized("unauthorized")
	}
	return identity, nil
}
