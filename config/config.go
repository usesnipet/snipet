package config

import (
	"context"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	envConfig "github.com/sethvargo/go-envconfig"
)

type Config struct {
	Server   ServerConfig   `env:", prefix=SERVER_"`
	Database DatabaseConfig `env:", prefix=DB_"`
	Log      LogConfig      `env:", prefix=LOG_"`
	Auth     AuthConfig     `env:", prefix=AUTH_"`
	Env      string         `env:"ENV, default=development"`
	DevProxy string         `env:"DEV_PROXY, default=http://localhost:5173"`
}

func Load() (*Config, error) {
	if path := findDotEnv(); path != "" {
		_ = godotenv.Load(path)
	}

	ctx := context.Background()
	var cfg = &Config{}
	var err = envConfig.Process(ctx, cfg)
	return cfg, err
}

func findDotEnv() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}

	for {
		candidate := filepath.Join(dir, ".env")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}
