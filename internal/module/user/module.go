package user

import (
	"github.com/gofiber/fiber/v3"
	"go.uber.org/fx"
)

var Module = fx.Module("user",
	fx.Provide(NewUserRepository, NewUserService, NewUserHandler),
	fx.Invoke(func(api fiber.Router, handler *UserHandler) {
		handler.RegisterRoutes(api.Group("/users"))
	}),
)
