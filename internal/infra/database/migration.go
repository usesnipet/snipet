package database

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	_ "github.com/lib/pq"
	"github.com/usesnipet/snipet/app/config"
	"github.com/usesnipet/snipet/app/internal/logger"
)

func ensureDatabase(cfg *config.Config, logger *logger.Logger) error {
	if !cfg.Database.AutoCreate {
		logger.Info("auto-create is disabled, skipping database creation")
		return nil
	}

	dbName, adminDSN, err := postgresAdminDSN(cfg.Database.URL)
	if err != nil {
		return fmt.Errorf("parse database URL: %w", err)
	}

	if dbName == "postgres" {
		return nil
	}

	db, err := sql.Open("postgres", adminDSN)
	if err != nil {
		return fmt.Errorf("open admin database: %w", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return fmt.Errorf("ping admin database: %w", err)
	}

	var exists bool
	if err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)`,
		dbName,
	).Scan(&exists); err != nil {
		return fmt.Errorf("check database existence: %w", err)
	}

	if exists {
		logger.Infof("database %q already exists", dbName)
		return nil
	}

	logger.Infof("creating database %q", dbName)
	if _, err := db.Exec(fmt.Sprintf("CREATE DATABASE %s", pq.QuoteIdentifier(dbName))); err != nil {
		return fmt.Errorf("create database: %w", err)
	}

	logger.Infof("database %q created successfully", dbName)
	return nil
}

func postgresAdminDSN(dsn string) (dbName, adminDSN string, err error) {
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		u, parseErr := url.Parse(dsn)
		if parseErr != nil {
			return "", "", fmt.Errorf("parse DSN: %w", parseErr)
		}

		dbName = strings.TrimPrefix(u.Path, "/")
		if dbName == "" {
			return "", "", fmt.Errorf("database name missing in DSN")
		}

		u.Path = "/postgres"
		return dbName, u.String(), nil
	}

	cfg, err := pgconn.ParseConfig(dsn)
	if err != nil {
		return "", "", fmt.Errorf("parse DSN: %w", err)
	}

	dbName = cfg.Database
	if dbName == "" {
		return "", "", fmt.Errorf("database name missing in DSN")
	}

	adminCfg := cfg.Copy()
	adminCfg.Database = "postgres"
	return dbName, keywordDSN(adminCfg), nil
}

func keywordDSN(cfg *pgconn.Config) string {
	var b strings.Builder
	b.WriteString("host=")
	b.WriteString(cfg.Host)
	b.WriteString(" port=")
	b.WriteString(strconv.FormatUint(uint64(cfg.Port), 10))
	b.WriteString(" user=")
	b.WriteString(cfg.User)
	if cfg.Password != "" {
		b.WriteString(" password=")
		b.WriteString(cfg.Password)
	}
	b.WriteString(" dbname=")
	b.WriteString(cfg.Database)
	for key, value := range cfg.RuntimeParams {
		b.WriteString(" ")
		b.WriteString(key)
		b.WriteString("=")
		b.WriteString(value)
	}
	return b.String()
}

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
