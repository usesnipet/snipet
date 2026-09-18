package guard_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/guard"
	"github.com/usesnipet/snipet/internal/model"
)

func TestRequireRole_NoIdentity(t *testing.T) {
	t.Parallel()
	gate := guard.RequireRole(model.RoleAdmin)

	_, err := gate(httptest.NewRequest(http.MethodGet, "/", nil))

	var appErr *apperr.Error
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
}

func TestRequireRole_WrongRole(t *testing.T) {
	t.Parallel()
	gate := guard.RequireRole(model.RoleAdmin)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = r.WithContext(auth.SetUserIdentity(r.Context(), auth.UserIdentity{ID: "u1", Role: model.RoleUser}))

	_, err := gate(r)

	var appErr *apperr.Error
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
}

func TestRequireRole_MatchingRole(t *testing.T) {
	t.Parallel()
	gate := guard.RequireRole(model.RoleAdmin, model.RoleUser)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = r.WithContext(auth.SetUserIdentity(r.Context(), auth.UserIdentity{ID: "u1", Role: model.RoleUser}))

	ctx, err := gate(r)

	require.NoError(t, err)
	identity, err := auth.CurrentUser(ctx)
	require.NoError(t, err)
	assert.Equal(t, "u1", identity.ID)
}
