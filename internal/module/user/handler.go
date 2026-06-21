package user

import (
	"github.com/gofiber/fiber/v3"
	"github.com/usesnipet/snipet/app/internal/logger"
	"github.com/usesnipet/snipet/app/internal/model"
)

type Handler struct {
	service *Service
	logger  *logger.Logger
}

func (h *Handler) RegisterRoutes(router fiber.Router) {
	users := router.Group("/users")
	users.Post("/create-account", h.CreateAccount)
	users.Post("/login", h.Login)
}

func (h *Handler) CreateAccount(c fiber.Ctx) error {
	var dto CreateAccountDTO
	h.logger.Verbosef("%s %s CreateAccount", c.Method(), c.Path())
	if err := c.Bind().Body(&dto); err != nil {
		return err
	}
	response, err := h.service.CreateAccount(c.Context(), dto, model.RoleUser)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(response)
}

func (h *Handler) Login(c fiber.Ctx) error {
	var dto LoginDTO
	h.logger.Debugf("%s %s Login", c.Method(), c.Path())
	if err := c.Bind().Body(&dto); err != nil {
		return err
	}
	h.logger.Debugf("LoginDTO: %+v", dto)

	response, err := h.service.Login(c.Context(), dto)
	if err != nil {
		return err
	}

	c.Cookie(&fiber.Cookie{
		Name:    "access_token",
		Value:   response.Tokens.AccessToken.Token,
		Expires: response.Tokens.AccessToken.ExpiresAt,
	})
	c.Cookie(&fiber.Cookie{
		Name:    "refresh_token",
		Value:   response.Tokens.RefreshToken.Token,
		Expires: response.Tokens.RefreshToken.ExpiresAt,
	})

	return c.Status(fiber.StatusOK).JSON(response)
}

func NewHandler(service *Service, logger *logger.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}
