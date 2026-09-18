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

func newTestService(repo *mocks.MockIUserRepository, refreshRepo *mocks.MockIRefreshTokenRepository) *auth.Service {
	cfg := testAuthConfig()
	return auth.NewService(repo, coreauth.NewJWTService(cfg), cfg, refreshRepo, coreauth.NewTokenService())
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
	svc := newTestService(repo, mocks.NewMockIRefreshTokenRepository(t))

	_, err := svc.Login(context.Background(), auth.LoginDTO{Username: "ghost", Password: "whatever"})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestLogin_WrongPassword(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "alice").Return(&model.User{
		ID: "u1", Username: "alice", Password: hashed(t, "correct-password"), Role: model.RoleUser,
	}, nil)
	svc := newTestService(repo, mocks.NewMockIRefreshTokenRepository(t))

	_, err := svc.Login(context.Background(), auth.LoginDTO{Username: "alice", Password: "wrong-password"})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestLogin_Success(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "alice").Return(&model.User{
		ID: "u1", Username: "alice", Password: hashed(t, "correct-password"), Role: model.RoleAdmin,
	}, nil)

	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	var stored *model.RefreshToken
	refreshRepo.EXPECT().Create(mock.Anything, mock.Anything).Run(func(_ context.Context, rt *model.RefreshToken) {
		stored = rt
	}).Return(nil)

	svc := newTestService(repo, refreshRepo)

	result, err := svc.Login(context.Background(), auth.LoginDTO{Username: "alice", Password: "correct-password"})
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
	assert.False(t, result.AccessTokenExpiresAt.IsZero())
	assert.Equal(t, "u1", result.User.ID)

	// A refresh token is minted and persisted hashed alongside the access token.
	require.NotNil(t, stored)
	assert.Equal(t, "u1", stored.UserID)
	assert.NotEmpty(t, stored.Hash)
	assert.NotEqual(t, result.RefreshToken, stored.Hash, "the stored value must be a hash, not the plaintext token")
	assert.Equal(t, stored.ExpiresAt, result.RefreshTokenExpiresAt)

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
	svc := newTestService(repo, mocks.NewMockIRefreshTokenRepository(t))

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

	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	refreshRepo.EXPECT().RevokeAllByUserID(mock.Anything, "u1").Return(nil)

	svc := newTestService(repo, refreshRepo)

	err := svc.ChangeOwnPassword(context.Background(), "u1", auth.ChangeOwnPasswordDTO{
		CurrentPassword: "correct-password", NewPassword: "brand-new-password",
	})
	require.NoError(t, err)
	require.NotNil(t, updates)
	require.NoError(t, coreauth.ComparePassword(updates.Password, "brand-new-password"))
	// refreshRepo.EXPECT().RevokeAllByUserID above fails the test on its own
	// (via t.Cleanup) if ChangeOwnPassword doesn't call it — a stolen
	// refresh token must not survive a password change.
}

func TestMe_PassesThrough(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "u1").Return(&model.User{ID: "u1"}, nil)
	svc := newTestService(repo, mocks.NewMockIRefreshTokenRepository(t))

	found, err := svc.Me(context.Background(), "u1")
	require.NoError(t, err)
	assert.Equal(t, "u1", found.ID)
}

func TestRefresh_UnknownToken(t *testing.T) {
	t.Parallel()
	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	refreshRepo.EXPECT().FindByHash(mock.Anything, mock.Anything).Return(nil, apperr.NotFound("refresh token not found"))
	svc := newTestService(mocks.NewMockIUserRepository(t), refreshRepo)

	_, err := svc.Refresh(context.Background(), auth.RefreshTokenDTO{RefreshToken: "does-not-exist"})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestRefresh_RevokedToken(t *testing.T) {
	t.Parallel()
	revokedAt := time.Now().Add(-time.Minute)
	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	refreshRepo.EXPECT().FindByHash(mock.Anything, mock.Anything).Return(&model.RefreshToken{
		ID: "rt1", UserID: "u1", ExpiresAt: time.Now().Add(time.Hour), RevokedAt: &revokedAt,
	}, nil)
	svc := newTestService(mocks.NewMockIUserRepository(t), refreshRepo)

	_, err := svc.Refresh(context.Background(), auth.RefreshTokenDTO{RefreshToken: "some-token"})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestRefresh_ExpiredToken(t *testing.T) {
	t.Parallel()
	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	refreshRepo.EXPECT().FindByHash(mock.Anything, mock.Anything).Return(&model.RefreshToken{
		ID: "rt1", UserID: "u1", ExpiresAt: time.Now().Add(-time.Minute),
	}, nil)
	svc := newTestService(mocks.NewMockIUserRepository(t), refreshRepo)

	_, err := svc.Refresh(context.Background(), auth.RefreshTokenDTO{RefreshToken: "some-token"})
	assertStatus(t, err, http.StatusUnauthorized)
}

func TestRefresh_Success(t *testing.T) {
	t.Parallel()
	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	refreshRepo.EXPECT().FindByHash(mock.Anything, mock.Anything).Return(&model.RefreshToken{
		ID: "rt1", UserID: "u1", ExpiresAt: time.Now().Add(time.Hour),
	}, nil)
	var stored *model.RefreshToken
	refreshRepo.EXPECT().Create(mock.Anything, mock.Anything).Run(func(_ context.Context, rt *model.RefreshToken) {
		stored = rt
	}).Return(nil)
	refreshRepo.EXPECT().RevokeByID(mock.Anything, "rt1").Return(nil)
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "u1").Return(&model.User{ID: "u1", Role: model.RoleUser}, nil)

	svc := newTestService(repo, refreshRepo)

	result, err := svc.Refresh(context.Background(), auth.RefreshTokenDTO{RefreshToken: "some-token"})
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
	assert.False(t, result.AccessTokenExpiresAt.IsZero())

	// Refresh rotates: a brand new refresh token is minted and persisted
	// hashed alongside the new access token.
	require.NotNil(t, stored)
	assert.Equal(t, "u1", stored.UserID)
	assert.NotEmpty(t, stored.Hash)
}

func TestLogout_RevokesTheMatchingToken(t *testing.T) {
	t.Parallel()
	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	refreshRepo.EXPECT().FindByHash(mock.Anything, mock.Anything).Return(&model.RefreshToken{ID: "rt1", UserID: "u1"}, nil)
	refreshRepo.EXPECT().RevokeByID(mock.Anything, "rt1").Return(nil)
	svc := newTestService(mocks.NewMockIUserRepository(t), refreshRepo)

	require.NoError(t, svc.Logout(context.Background(), auth.RefreshTokenDTO{RefreshToken: "some-token"}))
}

func TestLogout_UnknownTokenIsNotAnError(t *testing.T) {
	t.Parallel()
	refreshRepo := mocks.NewMockIRefreshTokenRepository(t)
	refreshRepo.EXPECT().FindByHash(mock.Anything, mock.Anything).Return(nil, apperr.NotFound("refresh token not found"))
	svc := newTestService(mocks.NewMockIUserRepository(t), refreshRepo)

	require.NoError(t, svc.Logout(context.Background(), auth.RefreshTokenDTO{RefreshToken: "already-gone"}))
}
