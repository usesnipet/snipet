package config

import "time"

type AuthConfig struct {
	JWTSecret     string        `env:"JWT_SECRET, default=change-me-in-production"`
	JWTExpiration time.Duration `env:"JWT_EXPIRATION, default=15m"`
	JWTIssuer     string        `env:"JWT_ISSUER"`
	JWTAudience   string        `env:"JWT_AUDIENCE"`

	RefreshTokenExpiration time.Duration `env:"REFRESH_TOKEN_EXPIRATION, default=720h"`
}
