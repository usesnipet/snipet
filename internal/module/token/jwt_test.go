package token_test

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/app/config"
	"github.com/usesnipet/snipet/app/internal/model"
	"github.com/usesnipet/snipet/app/internal/module/token"
)

const testSecret = "test-secret"

func newTestService(t *testing.T, expiration time.Duration) *token.Service {
	t.Helper()
	return token.NewService(&config.Config{
		Auth: config.AuthConfig{
			JWTSecret:              testSecret,
			JWTExpiration:          expiration,
			RefreshTokenSecret:     "test-refresh-secret",
			RefreshTokenExpiration: 72 * time.Hour,
		},
	})
}

func testUser(role model.Role) model.User {
	return model.User{
		ID:       uuid.MustParse("550e8400-e29b-41d4-a716-446655440000"),
		Nickname: "mayron",
		Name:     "Mayron",
		Email:    "mayron@example.com",
		Role:     role,
	}
}

func parseClaims(t *testing.T, tokenString string, secret string) jwt.MapClaims {
	t.Helper()

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(*jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	require.NoError(t, err)

	return claims
}

func TestGenerateReturnsValidToken(t *testing.T) {
	svc := newTestService(t, time.Hour)
	user := testUser(model.RoleUser)

	tokens, err := svc.Generate(user)
	require.NoError(t, err)
	assert.NotEmpty(t, tokens.AccessToken.Token)
	assert.WithinDuration(t, time.Now().Add(time.Hour), tokens.AccessToken.ExpiresAt, 2*time.Second)

	claims := parseClaims(t, tokens.AccessToken.Token, testSecret)
	assert.Equal(t, user.ID.String(), claims["sub"])
	assert.Equal(t, user.Email, claims["email"])
	assert.Equal(t, user.Name, claims["name"])
	assert.Equal(t, user.Nickname, claims["nickname"])
	assert.Equal(t, string(model.RoleUser), claims["role"])
	assert.NotNil(t, claims["iat"])
	assert.NotNil(t, claims["exp"])
}

func TestGenerateUsesConfiguredExpiration(t *testing.T) {
	svc := newTestService(t, 30*time.Minute)
	user := testUser(model.RoleUser)

	tokens, err := svc.Generate(user)
	require.NoError(t, err)
	assert.WithinDuration(t, time.Now().Add(30*time.Minute), tokens.AccessToken.ExpiresAt, 2*time.Second)
}

func TestGenerateWithAdminRole(t *testing.T) {
	svc := newTestService(t, time.Hour)
	user := testUser(model.RoleAdmin)

	tokens, err := svc.Generate(user)
	require.NoError(t, err)

	claims := parseClaims(t, tokens.AccessToken.Token, testSecret)
	assert.Equal(t, string(model.RoleAdmin), claims["role"])
}

func TestGenerateRejectsWrongSecret(t *testing.T) {
	svc := newTestService(t, time.Hour)
	user := testUser(model.RoleUser)

	tokens, err := svc.Generate(user)
	require.NoError(t, err)

	claims := jwt.MapClaims{}
	_, err = jwt.ParseWithClaims(tokens.AccessToken.Token, claims, func(*jwt.Token) (any, error) {
		return []byte("wrong-secret"), nil
	})
	require.Error(t, err)
}

func TestGenerateUsesHS256(t *testing.T) {
	svc := newTestService(t, time.Hour)
	user := testUser(model.RoleUser)

	tokens, err := svc.Generate(user)
	require.NoError(t, err)

	parsed, _, err := jwt.NewParser().ParseUnverified(tokens.AccessToken.Token, &token.Claims{})
	require.NoError(t, err)
	assert.Equal(t, jwt.SigningMethodHS256.Alg(), parsed.Method.Alg())

	parsed2, _, err := jwt.NewParser().ParseUnverified(tokens.RefreshToken.Token, &token.Claims{})
	require.NoError(t, err)
	assert.Equal(t, jwt.SigningMethodHS256.Alg(), parsed2.Method.Alg())
}
