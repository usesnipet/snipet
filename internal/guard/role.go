package guard

import (
	"context"
	"net/http"

	"github.com/usesnipet/snipet/internal/api"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/pkg/collections/set"
)

// RequireRole authorizes the caller loaded by an earlier authentication
// gate (e.g. the JWT gate — see auth-middleware.md): it rejects the request
// with Forbidden unless auth.CurrentUser's role is one of roles. It must run
// after a gate that calls auth.SetUserIdentity; if none did, CurrentUser's
// Unauthorized propagates as-is.
//
// Unlike the authentication gates, RequireRole is not meant to compose with
// api.Or — it always resolves (never returns auth.ErrNotApplicable), so it
// is chained with a plain r.Use(...) after the authentication gate.
func RequireRole(roles ...model.Role) api.Gate {
	rolesSet := set.New(roles...)

	return func(r *http.Request) (context.Context, error) {
		identity, err := auth.CurrentUser(r.Context())
		if err != nil {
			return nil, err
		}
		if !rolesSet.Contains(identity.Role) {
			return nil, apperr.Forbidden("insufficient role")
		}
		return r.Context(), nil
	}
}
