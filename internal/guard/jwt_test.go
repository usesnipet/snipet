package guard_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/config"
	coreauth "github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/guard"
	"github.com/usesnipet/snipet/internal/model"
)

func testAuthConfig() config.AuthConfig {
	return config.AuthConfig{
		JWTSecret:     "test-secret-key-with-enough-length",
		JWTExpiration: time.Hour,
		JWTIssuer:     "https://test.snipet.example.com",
		JWTAudience:   "https://test.snipet.example.com",
	}
}

func TestRequireUserJWT_NoHeader(t *testing.T) {
	t.Parallel()
	gate := guard.RequireUserJWT(coreauth.NewJWTService(testAuthConfig()))

	_, err := gate(httptest.NewRequest(http.MethodGet, "/", nil))
	assert.ErrorIs(t, err, coreauth.ErrNotApplicable)
}

func TestRequireUserJWT_InvalidToken(t *testing.T) {
	t.Parallel()
	gate := guard.RequireUserJWT(coreauth.NewJWTService(testAuthConfig()))

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer not-a-real-token")

	_, err := gate(r)
	require.Error(t, err)
	assert.NotErrorIs(t, err, coreauth.ErrNotApplicable)
}

func TestRequireUserJWT_ValidToken(t *testing.T) {
	t.Parallel()
	cfg := testAuthConfig()
	jwtService := coreauth.NewJWTService(cfg)

	user := &model.User{
		ID:       "u1",
		Username: "alice",
		Role:     model.RoleAdmin,
	}
	token, _, err := jwtService.GenerateToken(user)
	require.NoError(t, err)

	gate := guard.RequireUserJWT(jwtService)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", token)

	ctx, err := gate(r)
	require.NoError(t, err)

	identity, err := coreauth.CurrentUser(ctx)
	require.NoError(t, err)
	assert.Equal(t, "u1", identity.ID)
	assert.Equal(t, "alice", identity.Username)
	assert.Equal(t, model.RoleAdmin, identity.Role)
}
