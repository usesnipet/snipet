package config

type DatabaseConfig struct {
	URL          string `env:"URL, default=postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"`
	MaxOpenConns int    `env:"MAX_OPEN_CONNS, default=25"`
	MaxIdleConns int    `env:"MAX_IDLE_CONNS, default=5"`
	MigrationDir string `env:"MIGRATION_DIR, default=migrations"`
	AutoMigrate  bool   `env:"AUTO_MIGRATE, default=true"`
	AutoCreate   bool   `env:"AUTO_CREATE, default=true"`
}
