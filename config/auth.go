package config

import "time"

type AuthConfig struct {
	BasicAuthUsername string `env:"BASIC_AUTH_USERNAME, default=admin"`
	BasicAuthPassword string `env:"BASIC_AUTH_PASSWORD, default=change-me-in-production"`

	JWTSecret     string        `env:"JWT_SECRET, default=change-me-in-production"`
	JWTExpiration time.Duration `env:"JWT_EXPIRATION, default=15m"`
	JWTIssuer     string        `env:"JWT_ISSUER, default=https://snipets.example.com"`
	JWTAudience   string        `env:"JWT_AUDIENCE, default=https://snipets.example.com"`

	RefreshTokenExpiration time.Duration `env:"REFRESH_TOKEN_EXPIRATION, default=720h"`
}
