package guard

import (
	"context"
	"errors"
	"net/http"

	"github.com/usesnipet/snipet/internal/api"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
)

// RequireUserJWT authenticates the caller via an "Authorization: Bearer ..."
// JWT issued by the auth module: on success it sets auth.UserIdentity on
// the context (from the token's UserClaims) for guard.RequireRole and the
// rest of the app to read via auth.CurrentUser.
//
// No token → auth.ErrNotApplicable, so it composes with api.Or; a token
// present but invalid/expired → apperr.Unauthorized.
func RequireUserJWT(jwtService *auth.JWTService) api.Gate {
	return func(r *http.Request) (context.Context, error) {
		claims, err := verifyBearerJWT(r, jwtService)
		if err != nil {
			if errors.Is(err, auth.ErrNotApplicable) {
				return nil, err
			}
			return nil, apperr.Unauthorized("invalid or expired token")
		}

		subject, err := claims.GetSubject()
		if err != nil || subject == "" {
			return nil, apperr.Unauthorized("invalid or expired token")
		}

		return auth.SetUserIdentity(r.Context(), auth.UserIdentity{
			ID:       subject,
			Username: claims.Username,
			Role:     claims.Role,
		}), nil
	}
}
