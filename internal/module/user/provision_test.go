package user_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/config"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/module/user"
	"github.com/usesnipet/snipet/internal/repository/mocks"
)

func testRootConfig() config.AuthConfig {
	return config.AuthConfig{RootUsername: "admin", RootPassword: "admin"}
}

func TestEnsureRoot_SkipsWhenUsersExist(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().CountAll(mock.Anything).Return(1, nil)

	created, err := user.EnsureRoot(context.Background(), repo, testRootConfig())
	require.NoError(t, err)
	assert.False(t, created)
}

func TestEnsureRoot_CreatesRootWhenEmpty(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().CountAll(mock.Anything).Return(0, nil)

	var stored *model.User
	repo.EXPECT().Create(mock.Anything, mock.Anything).Run(func(_ context.Context, u *model.User) {
		stored = u
	}).Return(nil)

	created, err := user.EnsureRoot(context.Background(), repo, testRootConfig())
	require.NoError(t, err)
	assert.True(t, created)

	require.NotNil(t, stored)
	assert.Equal(t, "admin", stored.Username)
	assert.Equal(t, model.RoleAdmin, stored.Role)
	assert.NotEqual(t, "admin", stored.Password, "password must be hashed, not stored in plaintext")
	require.NoError(t, auth.ComparePassword(stored.Password, "admin"))
}

func TestResetRoot_NoRootUser(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "admin").Return(nil, apperr.NotFound("user not found"))

	err := user.ResetRoot(context.Background(), repo, testRootConfig())
	require.Error(t, err)
}

func TestResetRoot_GeneratesAndPersistsNewPassword(t *testing.T) {
	t.Parallel()
	repo := mocks.NewMockIUserRepository(t)
	repo.EXPECT().FindByUsername(mock.Anything, "admin").Return(&model.User{ID: "root-1", Username: "admin"}, nil)

	var updates *model.User
	repo.EXPECT().UpdateByID(mock.Anything, "root-1", mock.Anything).Run(func(_ context.Context, _ string, u *model.User) {
		updates = u
	}).Return(nil)

	err := user.ResetRoot(context.Background(), repo, testRootConfig())
	require.NoError(t, err)

	require.NotNil(t, updates)
	require.NoError(t, auth.ComparePassword(updates.Password, testRootConfig().RootPassword))
}
