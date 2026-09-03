package config

type LogConfig struct {
	Level string `env:"LEVEL, default=info"`
}
