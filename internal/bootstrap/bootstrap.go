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
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/llm/providers"
	"github.com/usesnipet/snipet/internal/logger"
	llmconnection "github.com/usesnipet/snipet/internal/module/llm-connection"
	systemmodule "github.com/usesnipet/snipet/internal/module/system"
	usermodule "github.com/usesnipet/snipet/internal/module/user"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/web"
)

// Bootstrap wires the application: database, repositories, services,
// handlers, HTTP server. Add a new module here after scaffolding it with
// the create-backend-module skill — construct its repo, then its service,
// then its handler, then call RegisterRoutes inside the /api group.
func Bootstrap(cfg *config.Config, log *logger.Logger) error {
	// database
	db, _, embeddedDB, err := database.NewDatabase(cfg, log)
	if err != nil {
		log.Errorf("failed to create database: %v", err)
		return err
	}

	if embeddedDB != nil {
		defer func() {
			log.Infof("stopping embedded database...")
			if err := embeddedDB.Stop(); err != nil {
				log.Errorf("failed to stop embedded database: %v", err)
				return
			}
			log.Infof("embedded database stopped successfully")
		}()
	}

	// repositories
	//   txManager := repository.NewTxManager(db)
	//   fooRepo := repository.NewFooRepository(db)
	_ = repository.NewTxManager(db)
	llmConnectionRepo := repository.NewLlmConnectionRepository(db)
	userRepo := repository.NewUserRepository(db)

	llmRegistry := providers.Registry(log.Child(logger.WithPrefix("llm-registry:")))
	llmManager := llm.NewManager(llmRegistry)

	// guards
	requireBasicAuth := guard.RequireBasicAuth(cfg.Auth.BasicAuthUsername, cfg.Auth.BasicAuthPassword)
	// TODO(auth-guards issue): replace with the JWT authentication gate.
	// auth.CurrentUser (read by guard.RequireRole below) is only ever
	// populated by that JWT guard — until it lands, /users is gated on
	// admin basic auth as an interim measure.
	requireUserAuth := requireBasicAuth
	// The role-gate factory itself — built once here, parameterized with
	// the actual roles by whichever handler needs it (see usermodule.NewHandler).
	requireRole := guard.RequireRole

	// services
	systemService := systemmodule.NewService()
	llmConnectionService := llmconnection.NewService(llmConnectionRepo, llmManager)
	userService := usermodule.NewService(userRepo)

	// handlers
	systemHandler := systemmodule.NewHandler(systemService)
	llmConnectionHandler := llmconnection.NewHandler(llmConnectionService)
	userHandler := usermodule.NewHandler(userService, requireUserAuth, requireRole)

	// register routes
	api := api.New()
	api.Router.Handle("/*", web.Handler())
	api.Router.Route(config.APIPrefix, func(r chi.Router) {
		systemHandler.RegisterRoutes(r, api.Serve)
		llmConnectionHandler.RegisterRoutes(r, api.Serve)
		userHandler.RegisterRoutes(r, api.Serve)
	})

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: api.Router,
	}

	go func() {
		log.Infof("server started on port %d", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Errorf("failed to start server: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	log.Infof("shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Errorf("failed to shutdown server: %v", err)
	}

	return nil
}
