package auth_test

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/config"
	"github.com/usesnipet/snipet/internal/auth"
)

func testAuthConfig() config.AuthConfig {
	return config.AuthConfig{
		JWTSecret:     "test-secret-key-with-enough-length",
		JWTExpiration: time.Hour,
		JWTIssuer:     "https://test.snipet.example.com",
		JWTAudience:   "https://test.snipet.example.com",
	}
}

func newTestJWTService(cfg config.AuthConfig) *auth.JWTService[*auth.UserClaims] {
	return auth.NewJWTService(cfg, func() *auth.UserClaims { return &auth.UserClaims{} })
}

func testClaims(cfg config.AuthConfig, scope, subject string) *auth.UserClaims {
	return &auth.UserClaims{
		BaseClaims: auth.NewBaseClaims(cfg, subject),
		Scope:      scope,
	}
}

func TestGenerateTokenReturnsBearerToken(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	token, _, err := service.GenerateToken(testClaims(cfg, "read:widgets", "11111111-1111-1111-1111-111111111111"))
	require.NoError(t, err)

	assert.True(t, strings.HasPrefix(token, "Bearer "))
}

func TestGenerateTokenEmbedsExpectedClaims(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	subject := "11111111-1111-1111-1111-111111111111"
	input := testClaims(cfg, "read:widgets", subject)

	token, expiresAt, err := service.GenerateToken(input)
	require.NoError(t, err)

	claims, err := service.VerifyToken(token)
	require.NoError(t, err)

	assert.Equal(t, "read:widgets", claims.Scope)
	assert.Equal(t, subject, claims.Subject)
	assert.Equal(t, cfg.JWTIssuer, claims.Issuer)
	assert.Equal(t, cfg.JWTAudience, claims.Audience[0])
	assert.WithinDuration(t, time.Now(), claims.IssuedAt.Time, time.Second)
	assert.WithinDuration(t, expiresAt, claims.ExpiresAt.Time, time.Second)
}

func TestVerifyTokenAcceptsValidToken(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	input := testClaims(cfg, "read:widgets", "11111111-1111-1111-1111-111111111111")

	token, _, err := service.GenerateToken(input)
	require.NoError(t, err)

	claims, err := service.VerifyToken(token)
	require.NoError(t, err)

	assert.Equal(t, input.Scope, claims.Scope)
	assert.Equal(t, input.Subject, claims.Subject)
	assert.Equal(t, input.Issuer, claims.Issuer)
}

func TestVerifyTokenAcceptsTokenWithoutBearerPrefix(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	service := newTestJWTService(cfg)
	token, _, err := service.GenerateToken(testClaims(cfg, "read:widgets", "11111111-1111-1111-1111-111111111111"))
	require.NoError(t, err)

	claims, err := service.VerifyToken(strings.TrimPrefix(token, "Bearer "))
	require.NoError(t, err)

	assert.Equal(t, "read:widgets", claims.Scope)
}

func TestVerifyTokenRejectsInvalidToken(t *testing.T) {
	t.Parallel()

	service := newTestJWTService(testAuthConfig())

	claims, err := service.VerifyToken("Bearer not.a.valid.token")
	require.Error(t, err)
	assert.Empty(t, claims.Scope)
}

func TestVerifyTokenRejectsWrongSecret(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	issuer := newTestJWTService(cfg)
	token, _, err := issuer.GenerateToken(testClaims(cfg, "read:widgets", "11111111-1111-1111-1111-111111111111"))
	require.NoError(t, err)

	otherSecret := testAuthConfig()
	otherSecret.JWTSecret = "another-secret-key-with-enough-length"
	verifier := newTestJWTService(otherSecret)

	claims, err := verifier.VerifyToken(token)
	require.Error(t, err)
	assert.Empty(t, claims.Scope)
}

func TestVerifyTokenRejectsExpiredToken(t *testing.T) {
	t.Parallel()

	cfg := testAuthConfig()
	cfg.JWTExpiration = -time.Minute
	service := newTestJWTService(cfg)

	token, _, err := service.GenerateToken(testClaims(cfg, "read:widgets", "11111111-1111-1111-1111-111111111111"))
	require.NoError(t, err)

	claims, err := service.VerifyToken(token)
	require.Error(t, err)
	assert.Empty(t, claims.Scope)
}
