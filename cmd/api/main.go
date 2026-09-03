package main

import (
	"fmt"
	"log"
	"os"

	"github.com/usesnipet/snipet/config"
	"github.com/usesnipet/snipet/internal/bootstrap"
	"github.com/usesnipet/snipet/internal/logger"
)

// @title						orders API
// @version					1.0
// @description				API for the orders platform.
// @BasePath					/api
// @securityDefinitions.apikey	ApiKeyAuth
// @in							header
// @name						X-API-Key
// @securityDefinitions.jwt	BearerAuth
// @in							header
// @name						Authorization
// @securityDefinitions.basic	BasicAuth
func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	level, parseErr := logger.ParseLevel(cfg.Log.Level)
	if parseErr != nil {
		fmt.Fprintf(os.Stderr, "warning: %v\n", parseErr)
		level = logger.LevelInfo
	}

	appLogger := logger.NewLogger(level)
	if parseErr != nil {
		appLogger.Warn(parseErr.Error())
	}

	bootstrap.Bootstrap(cfg, appLogger)
}
