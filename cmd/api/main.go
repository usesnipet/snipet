// @title           API Template
// @version         1.0
// @description     Documentation for the API Template.
// @BasePath        /api
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/usesnipet/snipet/app/config"
	_ "github.com/usesnipet/snipet/app/docs"
	"github.com/usesnipet/snipet/app/internal/app"
	"github.com/usesnipet/snipet/app/internal/logger"
	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"
)

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

	fx.New(
		fx.WithLogger(func() fxevent.Logger {
			return logger.NewFXEventLogger(appLogger)
		}),
		fx.StopTimeout(cfg.Server.ShutdownTimeout),
		fx.Supply(cfg, appLogger),
		app.Module,
	).Run()
}
