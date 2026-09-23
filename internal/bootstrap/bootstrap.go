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
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/guard"
	"github.com/usesnipet/snipet/internal/infra/cache"
	"github.com/usesnipet/snipet/internal/infra/database"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/llm/providers/ollama"
	"github.com/usesnipet/snipet/internal/logger"
	"github.com/usesnipet/snipet/internal/mcp"
	apikey "github.com/usesnipet/snipet/internal/module/api-key"
	authmodule "github.com/usesnipet/snipet/internal/module/auth"
	llmconnection "github.com/usesnipet/snipet/internal/module/llm-connection"
	mcpservermodule "github.com/usesnipet/snipet/internal/module/mcp-server"
	systemmodule "github.com/usesnipet/snipet/internal/module/system"
	toolmodule "github.com/usesnipet/snipet/internal/module/tool"
	usermodule "github.com/usesnipet/snipet/internal/module/user"
	"github.com/usesnipet/snipet/internal/queue"
	"github.com/usesnipet/snipet/internal/repository"
	"github.com/usesnipet/snipet/web"
)

// Bootstrap wires the application: database, repositories, services,
// handlers, HTTP server. Add a new module here after scaffolding it with
// the create-backend-module skill — construct its repo, then its service,
// then its handler, then call RegisterRoutes inside the /api group.
func Bootstrap(cfg *config.Config, log *logger.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

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
	refreshTokenRepo := repository.NewRefreshTokenRepository(db)
	apiKeyRepo := repository.NewApiKeyRepository(db)
	mcpServerRepo := repository.NewMcpServerRepository(db)
	toolRepo := repository.NewToolRepository(db)

	llmRegistry := llm.NewRegistry(cache.NewMemoryCache(2000, 0), 0)
	llmRegistry.MustRegister(ollama.New())
	llmRunner := llm.NewRunner(llmRegistry)

	// mcp
	mcpRegistry := mcp.NewRegistry()
	mcpConnector := mcp.NewConnector()

	// background jobs
	pool := queue.NewPool(cfg.Sync.Workers, log.Child(logger.WithPrefix("queue: ")))
	pool.Start(ctx)
	defer pool.Stop()
	mcpSyncWorker := mcpservermodule.NewSyncWorker(
		mcpservermodule.NewSyncService(mcpServerRepo, toolRepo, mcpConnector),
		mcpServerRepo,
		pool,
		cfg.Sync.Interval,
		log.Child(logger.WithPrefix("mcp-sync: ")),
	)
	mcpSyncWorker.Start(ctx)

	// auth primitives
	userJWTService := auth.NewJWTService(cfg.Auth)
	tokenService := auth.NewTokenService()

	// cache
	apiKeyCache := cache.NewMemoryCache(1000, 1*time.Hour)

	// services
	systemService := systemmodule.NewService()
	llmConnectionService := llmconnection.NewService(llmConnectionRepo, llmRegistry, llmRunner)
	userService := usermodule.NewService(userRepo, log.Child(logger.WithPrefix("user-service: ")))
	userService.InitializeRootUser(context.Background(), cfg.Auth)

	apiKeyService := apikey.NewService(
		log.Child(logger.WithPrefix("api-key-service: ")),
		apiKeyRepo,
		auth.NewAPIKeyGenerator(),
		auth.NewKeyHasher(),
	)
	authService := authmodule.NewService(userRepo, userJWTService, cfg.Auth, refreshTokenRepo, tokenService)
	mcpServerService := mcpservermodule.NewService(mcpServerRepo, mcpRegistry, mcpSyncWorker)
	toolService := toolmodule.NewService(toolRepo, toolmodule.NewExecutor(toolRepo, mcpServerRepo, mcpConnector))

	// guards
	requireUserAuth := guard.RequireUserJWT(userJWTService)
	requireRole := guard.RequireRole
	requireApiKey := guard.RequireApiKey(apiKeyService, apiKeyCache)

	// handlers
	systemHandler := systemmodule.NewHandler(systemService)
	llmConnectionHandler := llmconnection.NewHandler(llmConnectionService, requireUserAuth, requireApiKey)
	userHandler := usermodule.NewHandler(userService, requireUserAuth, requireRole)
	authHandler := authmodule.NewHandler(authService, requireUserAuth)
	apiKeyHandler := apikey.NewHandler(apiKeyService, requireRole, requireUserAuth, requireApiKey)
	mcpServerHandler := mcpservermodule.NewHandler(mcpServerService, requireUserAuth, requireApiKey)
	toolHandler := toolmodule.NewHandler(toolService, requireUserAuth, requireApiKey)

	// register routes
	api := api.New(log.Child(logger.WithPrefix("api: ")))
	api.Router.Handle("/*", web.Handler())
	api.Router.Route(config.APIPrefix, func(r chi.Router) {
		systemHandler.RegisterRoutes(r, api.Serve)
		llmConnectionHandler.RegisterRoutes(r, api.Serve)
		userHandler.RegisterRoutes(r, api.Serve)
		authHandler.RegisterRoutes(r, api.Serve)
		apiKeyHandler.RegisterRoutes(r, api.Serve)
		mcpServerHandler.RegisterRoutes(r, api.Serve)
		toolHandler.RegisterRoutes(r, api.Serve)
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

	<-ctx.Done()

	log.Infof("shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Errorf("failed to shutdown server: %v", err)
	}

	return nil
}
