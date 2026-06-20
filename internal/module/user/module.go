package user

import (
	"github.com/gofiber/fiber/v3"
	"go.uber.org/fx"
)

var Module = fx.Module("user",
	fx.Provide(
		NewRepository,
		NewService,
		NewHandler,
	),
	fx.Invoke(func(api fiber.Router, handler *Handler) {
		handler.RegisterRoutes(api)
	}),
)
