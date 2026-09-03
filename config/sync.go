package config

type SyncConfig struct {
	Workers int `env:"WORKERS, default=4"`
}
