package app

import (
	"context"
	"fmt"
	"net"

	"github.com/gofiber/fiber/v3"
	"github.com/usesnipet/go-template/config"
	"github.com/usesnipet/go-template/internal/logger"
	"github.com/usesnipet/go-template/internal/module/database"
	"github.com/usesnipet/go-template/internal/module/user"
	"go.uber.org/fx"
)

var Module = fx.Module("app",
	database.Module,
	user.Module,
	fx.Provide(NewFiber),
	fx.Invoke(func(
		app *fiber.App,
		cfg *config.Config,
		log *logger.Logger,
		lc fx.Lifecycle,
	) {
		lc.Append(fx.Hook{
			OnStart: func(ctx context.Context) error {
				addr := fmt.Sprintf(":%d", cfg.Server.Port)
				ln, err := net.Listen("tcp", addr)
				if err != nil {
					return fmt.Errorf("listen on %s: %w", addr, err)
				}

				go func() {
					if err := app.Listener(ln); err != nil {
						log.Errorf("server listener stopped: %v", err)
					}
				}()

				log.Infof("server listening on %s", addr)
				return nil
			},
			OnStop: func(ctx context.Context) error {
				log.Info("shutting down server...")
				if err := app.ShutdownWithContext(ctx); err != nil {
					return fmt.Errorf("shutdown server: %w", err)
				}
				log.Info("server stopped")
				return nil
			},
		})
	}),
)
