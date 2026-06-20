package config

import "time"

type AuthConfig struct {
	JWTSecret     string        `env:"JWT_SECRET, default=change-me-in-production"`
	JWTExpiration time.Duration `env:"JWT_EXPIRATION, default=24h"`
}
