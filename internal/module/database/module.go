package database

import (
	"context"
	"fmt"

	"github.com/usesnipet/snipet/app/config"
	"github.com/usesnipet/snipet/app/internal/logger"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

var Module = fx.Module("database",
	fx.Provide(NewDatabase),
	fx.Invoke(func(
		lc fx.Lifecycle,
		db *gorm.DB,
		cfg *config.Config,
		logger *logger.Logger,
	) {
		lc.Append(fx.Hook{
			OnStart: func(ctx context.Context) error {
				if err := runMigrations(cfg, logger); err != nil {
					return fmt.Errorf("run migrations: %w", err)
				}
				return nil
			},
			OnStop: func(ctx context.Context) error {
				sqlDB, err := db.DB()
				if err != nil {
					return err
				}

				return sqlDB.Close()
			},
		})
	}),
)
