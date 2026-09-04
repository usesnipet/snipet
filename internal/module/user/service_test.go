package user_test

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/logger"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/module/user"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository/mocks"
)

func newTestService(repo *mocks.MockIUserRepository) *user.Service {
	return user.NewService(repo, logger.NewLogger(logger.LevelDebug))
}

func assertStatus(t *testing.T, err error, want int) {
	t.Helper()
	var appErr *apperr.Error
	require.True(t, errors.As(err, &appErr), "expected *apperr.Error, got %v", err)
	assert.Equal(t, want, appErr.StatusCode)
}

// Service methods take no position on who's calling — authorization is
// guard.RequireRole's job at the HTTP boundary (see handler_test.go /
// internal/guard). A plain context.Background() is enough here.

func TestCreate_InvalidRole(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), user.CreateUserDTO{
		Username: "alice", Name: "Alice", Password: "supersecret", Role: "superuser",
	})
	assertStatus(t, err, http.StatusBadRequest)
}

func TestCreate_DuplicateUsername(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "alice").Return(&model.User{ID: "u1"}, nil)
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), user.CreateUserDTO{
		Username: "alice", Name: "Alice", Password: "supersecret", Role: "user",
	})
	assertStatus(t, err, http.StatusConflict)
}

func TestCreate_HashesPasswordAndPersists(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "alice").Return(nil, apperr.NotFound("user not found"))

	var stored *model.User
	repo.EXPECT().Create(mock.Anything, mock.Anything).Run(func(_ context.Context, u *model.User) {
		stored = u
	}).Return(nil)

	svc := newTestService(repo)

	created, err := svc.Create(context.Background(), user.CreateUserDTO{
		Username: "alice", Name: "Alice", Password: "supersecret", Role: "user",
	})
	require.NoError(t, err)
	require.NotNil(t, stored)
	assert.NotEqual(t, "supersecret", stored.Password, "password must be hashed")
	assert.NotEmpty(t, stored.Password)
	assert.Equal(t, model.RoleUser, created.Role)
	require.NoError(t, auth.ComparePassword(created.Password, "supersecret"))
}

func TestFilter_PassesThrough(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().Filter(mock.Anything, mock.Anything).Return(&page.Paginated[model.User]{}, nil)
	svc := newTestService(repo)

	_, err := svc.Filter(context.Background(), user.FindUsersFilterDTO{})
	require.NoError(t, err)
}

func TestDelete_LastAdminRejected(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "a1").Return(&model.User{ID: "a1", Role: model.RoleAdmin}, nil)
	repo.EXPECT().CountByRole(mock.Anything, model.RoleAdmin).Return(int64(1), nil)
	svc := newTestService(repo)

	err := svc.DeleteByID(context.Background(), "a1")
	assertStatus(t, err, http.StatusForbidden)
}

func TestDelete_AdminWithPeers(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "a1").Return(&model.User{ID: "a1", Role: model.RoleAdmin}, nil)
	repo.EXPECT().CountByRole(mock.Anything, model.RoleAdmin).Return(int64(2), nil)
	repo.EXPECT().DeleteByID(mock.Anything, "a1").Return(nil)
	svc := newTestService(repo)

	require.NoError(t, svc.DeleteByID(context.Background(), "a1"))
}

func TestUpdate_DemoteLastAdminRejected(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "a1").Return(&model.User{ID: "a1", Role: model.RoleAdmin}, nil)
	repo.EXPECT().CountByRole(mock.Anything, model.RoleAdmin).Return(int64(1), nil)
	svc := newTestService(repo)

	demoted := "user"
	err := svc.Update(context.Background(), "a1", user.UpdateUserDTO{Role: &demoted})
	assertStatus(t, err, http.StatusForbidden)
}

func TestUpdate_NameOnlyPatch(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "u1").Return(&model.User{ID: "u1", Role: model.RoleUser}, nil)

	var updates *model.User
	repo.EXPECT().UpdateByID(mock.Anything, "u1", mock.Anything).Run(func(_ context.Context, _ string, u *model.User) {
		updates = u
	}).Return(nil)
	svc := newTestService(repo)

	name := "New Name"
	require.NoError(t, svc.Update(context.Background(), "u1", user.UpdateUserDTO{Name: &name}))
	require.NotNil(t, updates)
	assert.Equal(t, "New Name", updates.Name)
	assert.Empty(t, updates.Password)
	assert.Empty(t, string(updates.Role))
}

// TestUpdate_SelfServicePasswordChange is the shape the auth module's
// PUT /auth/me/password (issue #3) depends on: a non-admin caller changing
// only their own password must work — Update carries no caller-role check.
func TestUpdate_SelfServicePasswordChange(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByID(mock.Anything, "u1").Return(&model.User{ID: "u1", Role: model.RoleUser}, nil)

	var updates *model.User
	repo.EXPECT().UpdateByID(mock.Anything, "u1", mock.Anything).Run(func(_ context.Context, _ string, u *model.User) {
		updates = u
	}).Return(nil)
	svc := newTestService(repo)

	newPassword := "brand-new-password"
	require.NoError(t, svc.Update(context.Background(), "u1", user.UpdateUserDTO{Password: &newPassword}))
	require.NotNil(t, updates)
	require.NoError(t, auth.ComparePassword(updates.Password, newPassword))
}
