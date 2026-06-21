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
	secret            []byte
	expiration        time.Duration
	refreshSecret     []byte
	refreshExpiration time.Duration
}

func NewService(cfg *config.Config) *Service {
	return &Service{
		secret:            []byte(cfg.Auth.JWTSecret),
		expiration:        cfg.Auth.JWTExpiration,
		refreshSecret:     []byte(cfg.Auth.RefreshTokenSecret),
		refreshExpiration: cfg.Auth.RefreshTokenExpiration,
	}
}

func (s *Service) Generate(user model.User) (TokenResponseDTO, error) {
	expiresAt := time.Now().Add(s.expiration)
	refreshExpiresAt := time.Now().Add(s.refreshExpiration)
	accessToken, err := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		Claims{
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
		},
	).SignedString(s.secret)
	if err != nil {
		return TokenResponseDTO{}, fmt.Errorf("sign token: %w", err)
	}

	refreshToken, err := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			ExpiresAt: jwt.NewNumericDate(refreshExpiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	).SignedString(s.refreshSecret)

	if err != nil {
		return TokenResponseDTO{}, fmt.Errorf("sign token: %w", err)
	}

	return TokenResponseDTO{
		AccessToken: Token{
			Token:     accessToken,
			ExpiresAt: expiresAt,
		},
		RefreshToken: Token{
			Token:     refreshToken,
			ExpiresAt: refreshExpiresAt,
		},
	}, nil
}
