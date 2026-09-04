package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
)

const (
	// KeyLength defines the number of random bytes to generate
	// 32 bytes = 256 bits of entropy, sufficient for security
	KeyLength = 32

	// KeyPrefix helps identify the key type
	// Format: {prefix}_{randomPart}
	KeyPrefix = "sn" // snipet Key
)

// APIKeyGenerator handles secure API key generation
type APIKeyGenerator struct {
	prefix string
}

// NewAPIKeyGenerator creates a new generator with default settings
func NewAPIKeyGenerator() *APIKeyGenerator {
	return &APIKeyGenerator{
		prefix: KeyPrefix,
	}
}

// Generate a short key ID for lookups (first 10 chars of full key)
func (g *APIKeyGenerator) GetKeyID(fullKey string) string {
	if len(fullKey) < 10 {
		return fullKey
	}
	return fullKey[:10]
}

// Generate creates a new cryptographically secure API key
// Returns the full key (for the user) and the key ID (for lookups)
func (g *APIKeyGenerator) Generate() (fullKey string, keyID string, err error) {
	// Generate random bytes using crypto/rand for cryptographic security
	randomBytes := make([]byte, KeyLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// Encode to URL-safe base64 for easy transmission
	randomPart := base64.RawURLEncoding.EncodeToString(randomBytes)

	// Construct the full key with prefix
	fullKey = fmt.Sprintf("%s_%s", g.prefix, randomPart)

	keyID = g.GetKeyID(fullKey)

	return fullKey, keyID, nil
}

// ParseKey extracts components from a full API key
func (g *APIKeyGenerator) ParseKey(fullKey string) (prefix, randomPart string, err error) {
	parts := strings.SplitN(fullKey, "_", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid key format: expected 2 parts, got %d", len(parts))
	}

	return parts[0], parts[1], nil
}

// ValidateFormat checks if the key has the correct format
func (g *APIKeyGenerator) ValidateFormat(fullKey string) bool {
	prefix, randomPart, err := g.ParseKey(fullKey)
	if err != nil {
		return false
	}

	// Verify prefix matches
	if prefix != g.prefix {
		return false
	}
	// Verify random part has expected length
	expectedLen := base64.RawURLEncoding.EncodedLen(KeyLength)
	if len(randomPart) != expectedLen {
		return false
	}

	return true
}
