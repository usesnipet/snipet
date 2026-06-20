package user_test

import (
	"context"
	"errors"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/app/config"
	"github.com/usesnipet/snipet/app/internal/api"
	"github.com/usesnipet/snipet/app/internal/model"
	"github.com/usesnipet/snipet/app/internal/module/token"
	"github.com/usesnipet/snipet/app/internal/module/user"
	"github.com/usesnipet/snipet/app/internal/testutil"
)

var testDB = struct {
	pg *testutil.Postgres
}{}

func TestMain(m *testing.M) {
	ctx := context.Background()

	pg, err := testutil.StartPostgres(ctx)
	if err != nil {
		_, _ = os.Stderr.WriteString("setup postgres: " + err.Error() + "\n")
		os.Exit(1)
	}
	testDB.pg = pg

	code := m.Run()

	if err := pg.Cleanup(ctx); err != nil {
		_, _ = os.Stderr.WriteString("cleanup postgres: " + err.Error() + "\n")
		os.Exit(1)
	}

	os.Exit(code)
}

func setupService(t *testing.T) *user.Service {
	t.Helper()
	testutil.Truncate(t, testDB.pg.DB, "users")

	cfg := &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:     "test-secret",
			JWTExpiration: time.Hour,
		},
	}

	repo := user.NewRepository(testDB.pg.DB)
	tokenSvc := token.NewService(cfg)
	return user.NewService(repo, tokenSvc)
}

func TestCreateAccount(t *testing.T) {
	svc := setupService(t)
	ctx := context.Background()

	dto := user.CreateAccountDTO{
		Nickname: "mayron",
		Name:     "Mayron",
		Email:    "mayron@example.com",
		Password: "password123",
	}

	response, err := svc.CreateAccount(ctx, dto, model.RoleUser)
	require.NoError(t, err)
	assert.NotEmpty(t, response.ID)
	assert.Equal(t, "mayron", response.Nickname)
	assert.Equal(t, "Mayron", response.Name)
	assert.Equal(t, "mayron@example.com", response.Email)
	assert.NotEmpty(t, response.CreatedAt)
}

func TestCreateAccountDuplicateEmail(t *testing.T) {
	svc := setupService(t)
	ctx := context.Background()

	dto := user.CreateAccountDTO{
		Nickname: "mayron",
		Name:     "Mayron",
		Email:    "mayron@example.com",
		Password: "password123",
	}

	_, err := svc.CreateAccount(ctx, dto, model.RoleUser)
	require.NoError(t, err)

	duplicate := user.CreateAccountDTO{
		Nickname: "other",
		Name:     "Other User",
		Email:    "mayron@example.com",
		Password: "password123",
	}

	_, err = svc.CreateAccount(ctx, duplicate, model.RoleUser)
	require.Error(t, err)

	var appErr *api.AppError
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	assert.ErrorIs(t, appErr.Err, user.ErrUserEmailAlreadyExists)
}

func TestCreateAccountDuplicateNickname(t *testing.T) {
	svc := setupService(t)
	ctx := context.Background()

	dto := user.CreateAccountDTO{
		Nickname: "mayron",
		Name:     "Mayron",
		Email:    "mayron@example.com",
		Password: "password123",
	}

	_, err := svc.CreateAccount(ctx, dto, model.RoleUser)
	require.NoError(t, err)

	duplicate := user.CreateAccountDTO{
		Nickname: "mayron",
		Name:     "Other User",
		Email:    "other@example.com",
		Password: "password123",
	}

	_, err = svc.CreateAccount(ctx, duplicate, model.RoleUser)
	require.Error(t, err)

	var appErr *api.AppError
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	assert.ErrorIs(t, appErr.Err, user.ErrUserNicknameAlreadyExists)
}

func TestLoginWithEmail(t *testing.T) {
	svc := setupService(t)
	ctx := context.Background()

	dto := user.CreateAccountDTO{
		Nickname: "mayron",
		Name:     "Mayron",
		Email:    "mayron@example.com",
		Password: "password123",
	}
	_, err := svc.CreateAccount(ctx, dto, model.RoleUser)
	require.NoError(t, err)

	response, err := svc.Login(ctx, user.LoginDTO{
		Account:  "mayron@example.com",
		Password: "password123",
	})
	require.NoError(t, err)
	assert.NotEmpty(t, response.Token)
	assert.Equal(t, "mayron@example.com", response.Email)
	assert.Equal(t, "Mayron", response.Name)
	assert.Equal(t, "mayron", response.Nickname)
	assert.Equal(t, "user", response.Role)
	assert.NotEmpty(t, response.ExpiresAt)

	claims := jwt.MapClaims{}
	_, err = jwt.ParseWithClaims(response.Token, claims, func(token *jwt.Token) (any, error) {
		return []byte("test-secret"), nil
	})
	require.NoError(t, err)
	assert.Equal(t, "mayron@example.com", claims["email"])
	assert.Equal(t, "mayron", claims["nickname"])
}

func TestLoginWithNickname(t *testing.T) {
	svc := setupService(t)
	ctx := context.Background()

	_, err := svc.CreateAccount(ctx, user.CreateAccountDTO{
		Nickname: "mayron",
		Name:     "Mayron",
		Email:    "mayron@example.com",
		Password: "password123",
	}, model.RoleUser)
	require.NoError(t, err)

	response, err := svc.Login(ctx, user.LoginDTO{
		Account:  "mayron",
		Password: "password123",
	})
	require.NoError(t, err)
	assert.NotEmpty(t, response.Token)
	assert.Equal(t, "mayron", response.Nickname)
}

func TestLoginInvalidPassword(t *testing.T) {
	svc := setupService(t)
	ctx := context.Background()

	_, err := svc.CreateAccount(ctx, user.CreateAccountDTO{
		Nickname: "mayron",
		Name:     "Mayron",
		Email:    "mayron@example.com",
		Password: "password123",
	}, model.RoleUser)
	require.NoError(t, err)

	_, err = svc.Login(ctx, user.LoginDTO{
		Account:  "mayron@example.com",
		Password: "wrongpassword",
	})
	require.Error(t, err)

	var appErr *api.AppError
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
	assert.ErrorIs(t, appErr.Err, user.ErrInvalidCredentials)
}

func TestLoginUserNotFound(t *testing.T) {
	svc := setupService(t)
	ctx := context.Background()

	_, err := svc.Login(ctx, user.LoginDTO{
		Account:  "unknown@example.com",
		Password: "password123",
	})
	require.Error(t, err)

	var appErr *api.AppError
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
	assert.ErrorIs(t, appErr.Err, user.ErrInvalidCredentials)
}
