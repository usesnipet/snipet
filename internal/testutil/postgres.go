package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Postgres struct {
	DB        *gorm.DB
	DSN       string
	terminate func(context.Context) error
}

func StartPostgres(ctx context.Context) (*Postgres, error) {
	container, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("snipet_test"),
		tcpostgres.WithUsername("postgres"),
		tcpostgres.WithPassword("postgres"),
	)
	if err != nil {
		return nil, fmt.Errorf("start postgres container: %w", err)
	}

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = container.Terminate(ctx)
		return nil, fmt.Errorf("postgres connection string: %w", err)
	}

	if err := waitForDB(ctx, dsn); err != nil {
		_ = container.Terminate(ctx)
		return nil, fmt.Errorf("wait for postgres: %w", err)
	}

	if err := runMigrations(dsn); err != nil {
		_ = container.Terminate(ctx)
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	db, err := gorm.Open(gormpostgres.Open(dsn), &gorm.Config{})
	if err != nil {
		_ = container.Terminate(ctx)
		return nil, fmt.Errorf("open gorm db: %w", err)
	}

	return &Postgres{
		DB:  db,
		DSN: dsn,
		terminate: func(ctx context.Context) error {
			sqlDB, dbErr := db.DB()
			if dbErr == nil {
				_ = sqlDB.Close()
			}
			return container.Terminate(ctx)
		},
	}, nil
}

func (p *Postgres) Cleanup(ctx context.Context) error {
	if p.terminate == nil {
		return nil
	}
	return p.terminate(ctx)
}

func Truncate(t *testing.T, db *gorm.DB, tables ...string) {
	t.Helper()
	for _, table := range tables {
		require.NoError(t, db.Exec(fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE", table)).Error)
	}
}

func waitForDB(ctx context.Context, dsn string) error {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("open postgres: %w", err)
	}
	defer db.Close()

	deadline := time.Now().Add(30 * time.Second)
	for {
		if err := db.PingContext(ctx); err == nil {
			return nil
		} else if time.Now().After(deadline) {
			return fmt.Errorf("ping postgres: %w", err)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func runMigrations(dsn string) error {
	root, err := projectRoot()
	if err != nil {
		return err
	}

	migrationDir := filepath.Join(root, "migrations")
	m, err := migrate.New(
		fmt.Sprintf("file://%s", filepath.ToSlash(migrationDir)),
		dsn,
	)
	if err != nil {
		return fmt.Errorf("create migrate instance: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migrate up: %w", err)
	}

	return nil
}

func projectRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("get working directory: %w", err)
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod not found")
		}
		dir = parent
	}
}
