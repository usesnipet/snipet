package auth

import (
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/usesnipet/snipet/config"
	"github.com/usesnipet/snipet/internal/model"
)

type UserClaims struct {
	jwt.RegisteredClaims
	Username string     `json:"username"`
	Role     model.Role `json:"role"`
}

// JWTService issues and verifies the HS256 UserClaims tokens this app
// uses. Not generic — UserClaims is the only claims shape in the codebase.
type JWTService struct {
	config config.AuthConfig
}

func NewJWTService(config config.AuthConfig) *JWTService {
	return &JWTService{config: config}
}

func (s *JWTService) GenerateToken(user *model.User) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(s.config.JWTExpiration)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, UserClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.config.JWTIssuer,
			Subject:   user.ID,
			Audience:  jwt.ClaimStrings{s.config.JWTAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
		Username: user.Username,
		Role:     user.Role,
	})
	tokenString, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", time.Time{}, err
	}

	return fmt.Sprintf("Bearer %s", tokenString), expiresAt, nil
}

func (s *JWTService) VerifyToken(tokenString string) (*UserClaims, error) {
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	claims := &UserClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		return []byte(s.config.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}

	return claims, nil
}
