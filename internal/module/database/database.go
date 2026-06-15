package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/usesnipet/go-template/config"

	_ "ariga.io/atlas-provider-gorm/gormschema"
)

func NewDatabase(cfg *config.Config) (*gorm.DB, error) {
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
