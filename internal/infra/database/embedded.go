package database

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"

	"github.com/usesnipet/snipet/config"
	"github.com/usesnipet/snipet/internal/logger"
)

// startEmbeddedPostgres boots an embedded Postgres server for cfg.Database.URL.
// If a Postgres instance is already reachable there — e.g. an embedded
// process left running after a previous kill -9 — it reuses that instance
// instead of failing on "port already in use", and returns a nil instance
// since there's nothing new for the caller to stop.
func startEmbeddedPostgres(cfg *config.Config, logger *logger.Logger) (*embeddedpostgres.EmbeddedPostgres, error) {
	u, err := url.Parse(cfg.Database.URL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}

	dbName := strings.TrimPrefix(u.Path, "/")
	if dbName == "" {
		return nil, fmt.Errorf("database name missing in DB_URL")
	}

	port := uint32(5432)
	if p := u.Port(); p != "" {
		parsed, err := strconv.ParseUint(p, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("parse database port: %w", err)
		}
		port = uint32(parsed)
	}

	if isPostgresAlive(cfg.Database.URL) {
		logger.Warnf("embedded postgres already running on port %d, reusing existing instance", port)
		return nil, nil
	}

	password, _ := u.User.Password()

	dataPath := cfg.Database.EmbeddedDataPath
	if dataPath == "" {
		defaultPath, err := defaultEmbeddedDataPath()
		if err != nil {
			return nil, fmt.Errorf("resolve embedded postgres data path: %w", err)
		}
		dataPath = defaultPath
	}

	ep := embeddedpostgres.NewDatabase(embeddedpostgres.DefaultConfig().
		Username(u.User.Username()).
		Password(password).
		Database(dbName).
		Port(port).
		DataPath(dataPath),
	)

	logger.Infof("starting embedded postgres on port %d (data path: %s)", port, dataPath)
	if err := ep.Start(); err != nil {
		return nil, fmt.Errorf("start embedded postgres: %w", err)
	}

	return ep, nil
}

// isPostgresAlive reports whether a Postgres server is already reachable
// and accepting cfg.Database.URL's credentials.
func isPostgresAlive(dsn string) bool {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return false
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	return db.PingContext(ctx) == nil
}

// defaultEmbeddedDataPath returns the OS-appropriate config directory for
// persisting embedded postgres data (~/.config on Linux, Application
// Support on macOS, %AppData% on Windows).
func defaultEmbeddedDataPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "snipet", "postgres"), nil
}
