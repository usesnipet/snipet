package auth

import (
	"context"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/model"
)

// UserIdentity is the operator authenticated via a JWT issued by the auth
// module.
type UserIdentity struct {
	ID       string     `json:"id"`
	Username string     `json:"username"`
	Role     model.Role `json:"role"`
}

// IsAdmin reports whether the identity carries the admin role.
func (u UserIdentity) IsAdmin() bool {
	return u.Role == model.RoleAdmin
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
