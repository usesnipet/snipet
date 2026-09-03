package auth_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/auth"
)

func TestHashReturnsArgon2IDFormat(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()
	hash, err := hasher.Hash("sn_test-api-key")
	require.NoError(t, err)

	assert.True(t, strings.HasPrefix(hash, "$argon2id$"))
	assert.Contains(t, hash, "$m=65536,t=1,p=4$")
}

func TestHashGeneratesUniqueHashesForSameKey(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()
	key := "sn_same-key-material"

	first, err := hasher.Hash(key)
	require.NoError(t, err)

	second, err := hasher.Hash(key)
	require.NoError(t, err)

	assert.NotEqual(t, first, second)
}

func TestVerifyAcceptsMatchingKey(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()
	key := "sn_valid-api-key"

	hash, err := hasher.Hash(key)
	require.NoError(t, err)

	valid, err := hasher.Verify(key, hash)
	require.NoError(t, err)
	assert.True(t, valid)
}

func TestVerifyRejectsWrongKey(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()
	hash, err := hasher.Hash("sn_correct-key")
	require.NoError(t, err)

	valid, err := hasher.Verify("sn_wrong-key", hash)
	require.NoError(t, err)
	assert.False(t, valid)
}

func TestVerifyRejectsInvalidHashFormat(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()

	valid, err := hasher.Verify("sn_any-key", "not-an-argon2-hash")
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "invalid hash format")
}

func TestVerifyRejectsMalformedParameters(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()
	hash := "$argon2id$v=19$invalid-params$salt$hash"

	valid, err := hasher.Verify("sn_any-key", hash)
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "failed to parse parameters")
}

func TestVerifyRejectsInvalidSaltEncoding(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()
	hash := "$argon2id$v=19$m=65536,t=1,p=4$!!!invalid-base64!!!$hash"

	valid, err := hasher.Verify("sn_any-key", hash)
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "failed to decode salt")
}

func TestVerifyRejectsInvalidHashEncoding(t *testing.T) {
	t.Parallel()

	hasher := auth.NewKeyHasher()
	hash := "$argon2id$v=19$m=65536,t=1,p=4$c2FsdHNhbHRzYWx0$!!!invalid-base64!!!"

	valid, err := hasher.Verify("sn_any-key", hash)
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "failed to decode hash")
}
