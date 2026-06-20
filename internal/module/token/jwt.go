package token

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/usesnipet/snipet/app/config"
	"github.com/usesnipet/snipet/app/internal/model"
)

type Claims struct {
	UserID   string     `json:"sub"`
	Email    string     `json:"email"`
	Name     string     `json:"name"`
	Nickname string     `json:"nickname"`
	Role     model.Role `json:"role"`
	jwt.RegisteredClaims
}

type Service struct {
	secret     []byte
	expiration time.Duration
}

func NewService(cfg *config.Config) *Service {
	return &Service{
		secret:     []byte(cfg.Auth.JWTSecret),
		expiration: cfg.Auth.JWTExpiration,
	}
}

func (s *Service) Generate(user model.User) (string, time.Time, error) {
	expiresAt := time.Now().Add(s.expiration)

	claims := Claims{
		UserID:   user.ID.String(),
		Email:    user.Email,
		Name:     user.Name,
		Nickname: user.Nickname,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign token: %w", err)
	}

	return token, expiresAt, nil
}
