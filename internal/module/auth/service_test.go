package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/config"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	coreauth "github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/module/auth"
	"github.com/usesnipet/snipet/internal/repository/mocks"
)

func testAuthConfig() config.AuthConfig {
	return config.AuthConfig{
		JWTSecret:     "test-secret-key-with-enough-length",
		JWTExpiration: time.Hour,
		JWTIssuer:     "https://test.snipet.example.com",
		JWTAudience:   "https://test.snipet.example.com",
	}
}

func newTestService(t *testing.T, repo *mocks.MockIUserRepository) *auth.Service {
	cfg := testAuthConfig()
	return auth.NewService(repo, coreauth.NewJWTService(cfg), cfg, mocks.NewMockIRefreshTokenRepository(t), coreauth.NewTokenService())
}

func hashed(t *testing.T, password string) string {
	t.Helper()
	hash, err := coreauth.HashPassword(password)
	require.NoError(t, err)
	return hash
}

func assertStatus(t *testing.T, err error, want int) {
	t.Helper()
	var appErr *apperr.Error
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, want, appErr.StatusCode)
}

func TestLogin_UnknownUsername(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "ghost").Return(nil, apperr.NotFound("user not found"))
	svc := newTestService(t, repo)

	_, err := svc.Login(context.Background(), auth.LoginDTO{Username: "ghost", Password: "whatever"})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestLogin_WrongPassword(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "alice").Return(&model.User{
		ID: "u1", Username: "alice", Password: hashed(t, "correct-password"), Role: model.RoleUser,
	}, nil)
	svc := newTestService(t, repo)

	_, err := svc.Login(context.Background(), auth.LoginDTO{Username: "alice", Password: "wrong-password"})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestLogin_Success(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "alice").Return(&model.User{
		ID: "u1", Username: "alice", Password: hashed(t, "correct-password"), Role: model.RoleAdmin,
	}, nil)
	svc := newTestService(t, repo)

	result, err := svc.Login(context.Background(), auth.LoginDTO{Username: "alice", Password: "correct-password"})
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
	assert.False(t, result.AccessTokenExpiresAt.IsZero())
	assert.Equal(t, "u1", result.User.ID)

	// model.User.Password is json:"-" — serialized, the hash must not leak,
	// even though the Go struct still carries it in memory.
	body, err := json.Marshal(result)
	require.NoError(t, err)
	assert.NotContains(t, string(body), result.User.Password)

	// The issued token round-trips through this service's own JWTService
	// and carries the caller's role.
	cfg := testAuthConfig()
	claims, err := coreauth.NewJWTService(cfg).VerifyToken(result.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, model.RoleAdmin, claims.Role)
	subject, err := claims.GetSubject()
	require.NoError(t, err)
	assert.Equal(t, "u1", subject)
}

func TestChangeOwnPassword_WrongCurrentPassword(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "u1").Return(&model.User{
		ID: "u1", Password: hashed(t, "correct-password"),
	}, nil)
	svc := newTestService(t, repo)

	err := svc.ChangeOwnPassword(context.Background(), "u1", auth.ChangeOwnPasswordDTO{
		CurrentPassword: "wrong-password", NewPassword: "brand-new-password",
	})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestChangeOwnPassword_Success(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "u1").Return(&model.User{
		ID: "u1", Password: hashed(t, "correct-password"),
	}, nil)

	var updates *model.User
	repo.EXPECT().UpdateByID(mock.Anything, "u1", mock.Anything).Run(func(_ context.Context, _ string, u *model.User) {
		updates = u
	}).Return(nil)
	svc := newTestService(t, repo)

	err := svc.ChangeOwnPassword(context.Background(), "u1", auth.ChangeOwnPasswordDTO{
		CurrentPassword: "correct-password", NewPassword: "brand-new-password",
	})
	require.NoError(t, err)
	require.NotNil(t, updates)
	require.NoError(t, coreauth.ComparePassword(updates.Password, "brand-new-password"))
}

func TestMe_PassesThrough(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "u1").Return(&model.User{ID: "u1"}, nil)
	svc := newTestService(t, repo)

	found, err := svc.Me(context.Background(), "u1")
	require.NoError(t, err)
	assert.Equal(t, "u1", found.ID)
}
