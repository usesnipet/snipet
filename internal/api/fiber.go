package api

import (
	"io/fs"
	"strings"

	swaggo "github.com/gofiber/contrib/v3/swaggo"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/responsetime"
	"github.com/gofiber/fiber/v3/middleware/static"
	"github.com/usesnipet/snipet/app/config"
	errorhandler "github.com/usesnipet/snipet/app/internal/api/error-handler"
	"github.com/usesnipet/snipet/app/internal/validate"
	"github.com/usesnipet/snipet/app/web"
)

func NewFiber(cfg *config.Config) (*fiber.App, fiber.Router, error) {
	// region Error Handler
	builder := errorhandler.NewErrorHandlerBuilder()
	builder.AddMapper(func(err error) (error, bool) {
		if appErr, ok := err.(*AppError); ok {
			return fiber.NewError(appErr.StatusCode, appErr.Err.Error()), true
		}
		return err, false
	})
	builder.AddMapper(errorhandler.GormMapper)
	errorHandler := builder.Build()
	// endregion Error Handler

	// region Fiber App
	app := fiber.New(fiber.Config{
		AppName:         "API Template",
		ErrorHandler:    errorHandler,
		StructValidator: validate.NewValidator(),
	})
	// endregion Fiber App

	// region Middlewares
	app.Use(recover.New())
	app.Use(cors.New())
	app.Use(responsetime.New())
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
		Next: func(c fiber.Ctx) bool {
			return !strings.HasSuffix(c.Path(), ".html")
		},
	}))
	// endregion Middlewares

	// region Swagger
	app.Get("/swagger/*", swaggo.HandlerDefault)
	// endregion Swagger

	// region Static Files
	// Serve the static files from the web/dist directory
	dist, _ := fs.Sub(web.Dist, "dist")
	app.Get("/*", static.New("", static.Config{
		FS: dist,
		// Optional: Configure caching, browsing, etc.
		Browse: false,
	}))
	// endregion Static Files

	// region API Routes
	api := app.Group(config.APIPrefix)
	api.Get("/health", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})
	// endregion API Routes

	return app, api, nil
}
