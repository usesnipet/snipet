package config

import "time"

type ServerConfig struct {
	Port            int           `env:"PORT, default=8852"`
	ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT, default=15s"`
}
