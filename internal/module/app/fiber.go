package app

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
	"github.com/usesnipet/go-template/config"
	errorhandler "github.com/usesnipet/go-template/internal/module/app/error-handler"
	"github.com/usesnipet/go-template/web"
)

func NewFiber(cfg *config.Config) (*fiber.App, fiber.Router, error) {
	builder := errorhandler.NewErrorHandlerBuilder()
	builder.AddMapper(errorhandler.GormMapper)
	errorHandler := builder.Build()
	app := fiber.New(fiber.Config{
		AppName:      "API Template",
		ErrorHandler: errorHandler,
	})

	// Middlewares
	app.Use(recover.New())
	app.Use(cors.New())
	app.Use(responsetime.New())
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
		Next: func(c fiber.Ctx) bool {
			return !strings.HasSuffix(c.Path(), ".html")
		},
	}))

	app.Get("/swagger/*", swaggo.HandlerDefault)

	// Serve the static files from the web/dist directory
	dist, _ := fs.Sub(web.Dist, "dist")
	app.Get("/*", static.New("", static.Config{
		FS: dist,
		// Optional: Configure caching, browsing, etc.
		Browse: false,
	}))

	return app, app.Group(config.APIPrefix), nil
}
