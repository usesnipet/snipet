package auth_test

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/auth"
)

func TestGenerateReturnsValidKey(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	fullKey, keyID, err := generator.Generate()
	require.NoError(t, err)

	assert.True(t, generator.ValidateFormat(fullKey))
	assert.Equal(t, fullKey[:10], keyID)
}

func TestGenerateReturnsUniqueKeys(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	first, _, err := generator.Generate()
	require.NoError(t, err)

	second, _, err := generator.Generate()
	require.NoError(t, err)

	assert.NotEqual(t, first, second)
}

func TestGetKeyIDReturnsFirstTenCharacters(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	fullKey := "sn_abcdefghijklmnopqrstuvwxyz"

	assert.Equal(t, "sn_abcdefg", generator.GetKeyID(fullKey))
}

func TestParseKeyExtractsPrefixAndRandomPart(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	prefix, randomPart, err := generator.ParseKey("sn_randomPart123")

	require.NoError(t, err)
	assert.Equal(t, "sn", prefix)
	assert.Equal(t, "randomPart123", randomPart)
}

func TestParseKeyRejectsMissingSeparator(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	_, _, err := generator.ParseKey("sninvalid")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid key format")
}

func TestParseKeyKeepsUnderscoresInRandomPart(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	prefix, randomPart, err := generator.ParseKey("sn_part_with_underscores")

	require.NoError(t, err)
	assert.Equal(t, "sn", prefix)
	assert.Equal(t, "part_with_underscores", randomPart)
}

func TestValidateFormatAcceptsGeneratedKey(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	fullKey, _, err := generator.Generate()
	require.NoError(t, err)

	assert.True(t, generator.ValidateFormat(fullKey))
}

func TestValidateFormatRejectsWrongPrefix(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()
	randomPart := strings.Repeat("a", base64.RawURLEncoding.EncodedLen(auth.KeyLength))

	assert.False(t, generator.ValidateFormat("bad_"+randomPart))
}

func TestValidateFormatRejectsWrongRandomPartLength(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()

	assert.False(t, generator.ValidateFormat("sn_tooshort"))
}

func TestValidateFormatRejectsInvalidFormat(t *testing.T) {
	t.Parallel()

	generator := auth.NewAPIKeyGenerator()

	assert.False(t, generator.ValidateFormat("not-a-valid-key"))
}
