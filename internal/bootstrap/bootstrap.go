package bootstrap

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/config"
	_ "github.com/usesnipet/snipet/docs/swagger"
	"github.com/usesnipet/snipet/internal/api"
	"github.com/usesnipet/snipet/internal/guard"
	"github.com/usesnipet/snipet/internal/infra/database"
	"github.com/usesnipet/snipet/internal/logger"
	systemmodule "github.com/usesnipet/snipet/internal/module/system"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/web"
)

// Bootstrap wires the application: database, repositories, services,
// handlers, HTTP server. Add a new module here after scaffolding it with
// the create-backend-module skill — construct its repo, then its service,
// then its handler, then call RegisterRoutes inside the /api group.
func Bootstrap(cfg *config.Config, logger *logger.Logger) error {
	// database
	db, _, embeddedDB, err := database.NewDatabase(cfg, logger)
	if err != nil {
		logger.Errorf("failed to create database: %v", err)
		return err
	}

	if embeddedDB != nil {
		defer func() {
			logger.Infof("stopping embedded database...")
			if err := embeddedDB.Stop(); err != nil {
				logger.Errorf("failed to stop embedded database: %v", err)
				return
			}
			logger.Infof("embedded database stopped successfully")
		}()
	}

	// repositories
	//   txManager := repository.NewTxManager(db)
	//   fooRepo := repository.NewFooRepository(db)
	_ = repository.NewTxManager(db)

	// guards
	requireBasicAuth := guard.RequireBasicAuth(cfg.Auth.BasicAuthUsername, cfg.Auth.BasicAuthPassword)
	_ = requireBasicAuth

	// services
	systemService := systemmodule.NewService()

	// handlers
	systemHandler := systemmodule.NewHandler(systemService)

	// register routes
	api := api.New()
	api.Router.Handle("/*", web.Handler())
	api.Router.Route(config.APIPrefix, func(r chi.Router) {
		systemHandler.RegisterRoutes(r, api.Serve)
	})

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: api.Router,
	}

	go func() {
		logger.Infof("server started on port %d", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Errorf("failed to start server: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	logger.Infof("shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Errorf("failed to shutdown server: %v", err)
	}

	return nil
}
