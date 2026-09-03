package database

import (
	"database/sql"
	"fmt"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/usesnipet/snipet/config"
	"github.com/usesnipet/snipet/internal/logger"
)

// NewDatabase connects to Postgres and runs pending migrations. When
// cfg.Database.Embedded is set, it first boots an embedded Postgres server
// and returns it so the caller can stop it on shutdown.
func NewDatabase(cfg *config.Config, logger *logger.Logger) (*gorm.DB, *sql.DB, *embeddedpostgres.EmbeddedPostgres, error) {
	var embedded *embeddedpostgres.EmbeddedPostgres
	if cfg.Database.Embedded {
		ep, err := startEmbeddedPostgres(cfg, logger)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("start embedded postgres: %w", err)
		}
		embedded = ep
	}

	if err := ensureDatabase(cfg, logger); err != nil {
		return nil, nil, embedded, fmt.Errorf("ensure database: %w", err)
	}

	sqlDB, err := sql.Open("pgx", cfg.Database.URL)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)

	if err != nil {
		return nil, nil, embedded, err
	}

	gormDB, err := gorm.Open(
		postgres.New(postgres.Config{Conn: sqlDB}),
		&gorm.Config{TranslateError: true, SkipDefaultTransaction: true},
	)
	if err != nil {
		return nil, nil, embedded, fmt.Errorf("open database: %w", err)
	}

	if err = runMigrations(cfg, logger); err != nil {
		return nil, nil, embedded, fmt.Errorf("run migrations: %w", err)
	}

	return gormDB, sqlDB, embedded, nil
}
