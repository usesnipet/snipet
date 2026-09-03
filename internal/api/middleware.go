package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/usesnipet/snipet/internal/auth"
)

type MiddlewareFunc func(next http.Handler) http.Handler

// Gate is a single authentication attempt against a request. On success it
// returns a context carrying whatever identity it authenticated (via
// SetApiKeyIdentity / SetAppUserIdentity). On
// failure it returns auth.ErrNotApplicable when its credential was simply
// absent from the request — so Or can fall through to the next gate — or
// any other error when the credential was present but invalid.
type Gate func(r *http.Request) (context.Context, error)

// Handler turns a Gate into chi-compatible middleware that requires it to
// succeed.
func (g Gate) Handler() MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, err := g(r)
			if err != nil {
				WriteError(w, http.StatusUnauthorized, errors.New("unauthorized"))
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Or tries each gate in order and keeps the context from the first that
// succeeds — every successful gate sets its own identity, so which one fired
// is recoverable downstream (auth.CurrentApiKey / CurrentAppUser / ...).
// Gates reporting auth.ErrNotApplicable (credential absent) are skipped; a
// gate whose credential is present but invalid fails the whole chain
// immediately. At least one gate must succeed.
func Or(gates ...Gate) Gate {
	return func(r *http.Request) (context.Context, error) {
		for _, g := range gates {
			ctx, err := g(r)
			if errors.Is(err, auth.ErrNotApplicable) {
				continue
			}
			if err != nil {
				return nil, err
			}
			return ctx, nil
		}
		return nil, errors.New("unauthorized")
	}
}
