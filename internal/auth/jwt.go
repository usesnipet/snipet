package auth

import (
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/usesnipet/snipet/config"
)

// Claims is the constraint every concrete claims type must satisfy to be
// used with JWTService — the jwt-go library's own Claims interface.
type Claims interface {
	jwt.Claims
}

// BaseClaims is the registered-claims set every token in this codebase
// carries. Each module embeds it in its own concrete claims type alongside
// whatever additional fields that module needs.
type BaseClaims struct {
	jwt.RegisteredClaims
}

func NewBaseClaims(cfg config.AuthConfig, subject string) BaseClaims {
	now := time.Now()
	return BaseClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    cfg.JWTIssuer,
			Subject:   subject,
			Audience:  jwt.ClaimStrings{cfg.JWTAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(cfg.JWTExpiration)),
		},
	}
}

// JWTService issues and verifies HS256 tokens carrying claims of type T.
type JWTService[T Claims] struct {
	config    config.AuthConfig
	newClaims func() T // factory so VerifyToken has a fresh instance to unmarshal into
}

func NewJWTService[T Claims](config config.AuthConfig, newClaims func() T) *JWTService[T] {
	return &JWTService[T]{config: config, newClaims: newClaims}
}

func (s *JWTService[T]) GenerateToken(claims T) (string, time.Time, error) {
	expiresAt, err := claims.GetExpirationTime()
	if err != nil || expiresAt == nil {
		return "", time.Time{}, fmt.Errorf("auth: claims must carry an expiration time")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", time.Time{}, err
	}

	return fmt.Sprintf("Bearer %s", tokenString), expiresAt.Time, nil
}

func (s *JWTService[T]) VerifyToken(tokenString string) (T, error) {
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	claims := s.newClaims()
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		return []byte(s.config.JWTSecret), nil
	})
	if err != nil {
		return s.newClaims(), err
	}

	return claims, nil
}
