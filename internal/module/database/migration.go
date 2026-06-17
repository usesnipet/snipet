package database

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/usesnipet/snipet/app/config"
	"github.com/usesnipet/snipet/app/internal/logger"
)

func runMigrations(cfg *config.Config, logger *logger.Logger) error {
	if !cfg.Database.AutoMigrate {
		logger.Info("auto-migrate is disabled, skipping migrations")
		return nil
	}

	logger.Info("running migrations...")
	dsn := cfg.Database.URL
	logger.Infof("running migrations from %s", dsn)
	root, err := os.Getwd()
	if err != nil {
		logger.Errorf("get working directory: %v", err)
		return fmt.Errorf("get working directory: %w", err)
	}
	dir := filepath.Join(root, cfg.Database.MigrationDir)
	logger.Infof("running migrations from %s", dir)
	m, err := migrate.New(fmt.Sprintf("file://%s", filepath.ToSlash(dir)), dsn)
	if err != nil {
		logger.Errorf("create migrate instance: %v", err)
		return fmt.Errorf("create migrate instance: %w", err)
	}

	if err := m.Up(); err != nil {
		if err == migrate.ErrNoChange {
			logger.Info("no migrations to apply")
			return nil
		}

		logger.Errorf("migrate up: %v", err)
		return fmt.Errorf("migrate up: %w", err)
	}

	logger.Info("migrations applied successfully")
	return nil
}
