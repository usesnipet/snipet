package config

import "time"

type AuthConfig struct {
	JWTSecret     string        `env:"JWT_SECRET, default=change-me-in-production"`
	JWTExpiration time.Duration `env:"JWT_EXPIRATION, default=15m"`
	JWTIssuer     string        `env:"JWT_ISSUER"`
	JWTAudience   string        `env:"JWT_AUDIENCE"`

	RefreshTokenExpiration time.Duration `env:"REFRESH_TOKEN_EXPIRATION, default=720h"`

	// RootUsername/RootPassword provision the first admin account on an
	// empty users table — see user.EnsureRoot.
	RootUsername string `env:"ROOT_USERNAME, default=admin"`
	RootPassword string `env:"ROOT_PASSWORD, default=admin"`
	// RootPasswordReset, when true, regenerates the root account's password
	// on every boot and logs it once — see user.ResetRoot.
	RootPasswordReset bool `env:"ROOT_PASSWORD_RESET, default=false"`
}
