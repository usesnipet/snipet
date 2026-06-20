package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/usesnipet/snipet/app/config"
	"github.com/usesnipet/snipet/app/internal/logger"

	_ "ariga.io/atlas-provider-gorm/gormschema"
)

func NewDatabase(cfg *config.Config, logger *logger.Logger) (*gorm.DB, error) {
	if err := ensureDatabase(cfg, logger); err != nil {
		return nil, fmt.Errorf("ensure database: %w", err)
	}

	gormDB, err := gorm.Open(
		postgres.Open(cfg.Database.URL),
		&gorm.Config{},
	)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql db: %w", err)
	}

	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)

	return gormDB, nil
}
