package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

const refreshTokenBytes = 32

type TokenService struct {
}

func NewTokenService() *TokenService {
	return &TokenService{}
}

// GenerateToken creates a cryptographically secure opaque token.
func (s *TokenService) GenerateToken() (string, error) {
	b := make([]byte, refreshTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HashToken returns the SHA-256 hex digest of a token for storage/lookup.
func (s *TokenService) HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
