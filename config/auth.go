package config

import "time"

type AuthConfig struct {
	JWTSecret              string        `env:"JWT_SECRET, default=change-me-in-production"`
	JWTExpiration          time.Duration `env:"JWT_EXPIRATION, default=24h"`
	RefreshTokenSecret     string        `env:"REFRESH_TOKEN_SECRET, default=change-me-in-production"`
	RefreshTokenExpiration time.Duration `env:"REFRESH_TOKEN_EXPIRATION, default=72h"`
}
