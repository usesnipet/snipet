package auth_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/app/internal/auth"
)

func TestHashPasswordReturnsBcryptHash(t *testing.T) {
	hash, err := auth.HashPassword("password123")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(hash, "$2a$") || strings.HasPrefix(hash, "$2b$"))
}

func TestHashPasswordGeneratesUniqueHashes(t *testing.T) {
	first, err := auth.HashPassword("password123")
	require.NoError(t, err)

	second, err := auth.HashPassword("password123")
	require.NoError(t, err)

	assert.NotEqual(t, first, second)
}

func TestComparePasswordMatchesCorrectPassword(t *testing.T) {
	password := "password123"
	hash, err := auth.HashPassword(password)
	require.NoError(t, err)

	err = auth.ComparePassword(hash, password)
	assert.NoError(t, err)
}

func TestComparePasswordRejectsWrongPassword(t *testing.T) {
	hash, err := auth.HashPassword("password123")
	require.NoError(t, err)

	err = auth.ComparePassword(hash, "wrongpassword")
	require.Error(t, err)
	assert.ErrorIs(t, err, auth.ErrComparePassword)
}

func TestComparePasswordRejectsInvalidHash(t *testing.T) {
	err := auth.ComparePassword("not-a-bcrypt-hash", "password123")
	require.Error(t, err)
	assert.ErrorIs(t, err, auth.ErrComparePassword)
}

func TestComparePasswordRejectsEmptyPassword(t *testing.T) {
	hash, err := auth.HashPassword("password123")
	require.NoError(t, err)

	err = auth.ComparePassword(hash, "")
	require.Error(t, err)
	assert.ErrorIs(t, err, auth.ErrComparePassword)
}

func TestComparePasswordDoesNotWrapBcryptError(t *testing.T) {
	err := auth.ComparePassword("invalid", "password123")
	require.Error(t, err)
	assert.True(t, errors.Is(err, auth.ErrComparePassword))
}
