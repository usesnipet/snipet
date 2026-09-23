package config

import "time"

type SyncConfig struct {
	Workers int `env:"WORKERS, default=4"`
	// Interval between MCP server tool syncs; 0 disables periodic syncs.
	Interval time.Duration `env:"INTERVAL, default=5m"`
}
