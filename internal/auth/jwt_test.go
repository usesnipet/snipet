package auth_test

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/config"
	"github.com/usesnipet/snipet/internal/auth"
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

func newTestJWTService(cfg config.AuthConfig) *auth.JWTService {
	return auth.NewJWTService(cfg)
}

func TestGenerateTokenReturnsBearerToken(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	user := &model.User{ID: "11111111-1111-1111-1111-111111111111", Username: "alice", Role: model.RoleUser}

	token, _, err := service.GenerateToken(user)
	require.NoError(t, err)

	assert.True(t, strings.HasPrefix(token, "Bearer "))
}

func TestGenerateTokenEmbedsExpectedClaims(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	user := &model.User{ID: "u1", Username: "alice", Role: model.RoleUser}

	token, expiresAt, err := service.GenerateToken(user)
	require.NoError(t, err)

	claims, err := service.VerifyToken(token)
	require.NoError(t, err)

	assert.Equal(t, "alice", claims.Username)
	assert.Equal(t, model.RoleUser, claims.Role)
	assert.Equal(t, user.ID, claims.Subject)
	assert.Equal(t, cfg.JWTIssuer, claims.Issuer)
	assert.Equal(t, cfg.JWTAudience, claims.Audience[0])
	assert.WithinDuration(t, time.Now(), claims.IssuedAt.Time, time.Second)
	assert.WithinDuration(t, expiresAt, claims.ExpiresAt.Time, time.Second)
}

func TestVerifyTokenAcceptsValidToken(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	user := &model.User{ID: "u1", Username: "alice", Role: model.RoleAdmin}

	token, _, err := service.GenerateToken(user)
	require.NoError(t, err)

	claims, err := service.VerifyToken(token)
	require.NoError(t, err)

	assert.Equal(t, user.Username, claims.Username)
	assert.Equal(t, user.Role, claims.Role)
	assert.Equal(t, user.ID, claims.Subject)
}

func TestVerifyTokenAcceptsTokenWithoutBearerPrefix(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	user := &model.User{ID: "u1", Username: "alice", Role: model.RoleUser}

	token, _, err := service.GenerateToken(user)
	require.NoError(t, err)

	claims, err := service.VerifyToken(strings.TrimPrefix(token, "Bearer "))
	require.NoError(t, err)

	assert.Equal(t, "alice", claims.Username)
}

func TestVerifyTokenRejectsInvalidToken(t *testing.T) {
	t.Parallel()

	service := newTestJWTService(testAuthConfig())

	claims, err := service.VerifyToken("Bearer not.a.valid.token")
	require.Error(t, err)
	assert.Nil(t, claims)
}

func TestVerifyTokenRejectsWrongSecret(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	issuer := newTestJWTService(cfg)
	user := &model.User{ID: "u1", Username: "alice", Role: model.RoleUser}

	token, _, err := issuer.GenerateToken(user)
	require.NoError(t, err)

	otherSecret := testAuthConfig()
	otherSecret.JWTSecret = "another-secret-key-with-enough-length"
	verifier := newTestJWTService(otherSecret)

	claims, err := verifier.VerifyToken(token)
	require.Error(t, err)
	assert.Nil(t, claims)
}

func TestVerifyTokenRejectsExpiredToken(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	cfg.JWTExpiration = -time.Minute
	service := newTestJWTService(cfg)
	user := &model.User{ID: "u1", Username: "alice", Role: model.RoleAdmin}

	token, _, err := service.GenerateToken(user)
	require.NoError(t, err)

	claims, err := service.VerifyToken(token)
	require.Error(t, err)
	assert.Nil(t, claims)
}
