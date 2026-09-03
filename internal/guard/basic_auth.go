package guard

import (
	"context"
	"crypto/subtle"
	"net/http"

	"github.com/usesnipet/snipet/internal/api"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
)

// RequireBasicAuth requires an "Authorization: Basic ..." header matching
// the single admin username/password configured via env vars (see
// config.AuthConfig) and sets an auth.BasicIdentity. There is no per-user
// store to look up — every module that used to gate on userMiddleware now
// gates on this instead.
func RequireBasicAuth(username, password string) api.Gate {
	return func(r *http.Request) (context.Context, error) {
		gotUsername, gotPassword, ok := r.BasicAuth()
		if !ok {
			return nil, auth.ErrNotApplicable
		}

		usernameMatch := subtle.ConstantTimeCompare([]byte(gotUsername), []byte(username)) == 1
		passwordMatch := subtle.ConstantTimeCompare([]byte(gotPassword), []byte(password)) == 1
		if !usernameMatch || !passwordMatch {
			return nil, apperr.Unauthorized("unauthorized")
		}

		return auth.SetBasicIdentity(r.Context(), auth.BasicIdentity{Username: gotUsername}), nil
	}
}
