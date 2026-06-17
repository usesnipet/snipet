package user

import (
	"github.com/gofiber/fiber/v3"
	"github.com/usesnipet/snipet/app/internal/crud"
	"github.com/usesnipet/snipet/app/internal/logger"
	"github.com/usesnipet/snipet/app/internal/model"
)

type UserHandler struct {
	*crud.Handler[model.User]
}

func (h *UserHandler) RegisterRoutes(router fiber.Router) {
	router.Get("/:id", h.FindByID)
	router.Get("/", h.FindAll)
	router.Post("/", h.Create)
	router.Put("/:id", h.UpdateByID)
	router.Delete("/:id", h.DeleteByID)
}

// FindByID godoc
//
//	@Summary		Find user by ID
//	@Description Return a user by ID.
//	@Tags			users
//	@Produce		json
//	@Param			id	path		string	true	"User ID"
//	@Success		200	{object}	model.User
//	@Failure		500	{object}	api.ErrorResponse
//	@Router			/users/{id} [GET]
func (h *UserHandler) FindByID(c fiber.Ctx) error {
	return h.Handler.FindByID(c)
}

// FindAll godoc
//
//	@Summary		Find all users
//	@Description	Return a list of users with pagination and optional filters.
//	@Tags			users
//	@Produce		json
//	@Param			take	query		int	false	"Maximum number of records"	default(2000)
//	@Param			skip	query		int	false	"Number of records to skip"	default(0)
//	@Success		200		{array}		model.User
//	@Failure		400		{object}	api.ErrorResponse
//	@Failure		500		{object}	api.ErrorResponse
//	@Router			/users [GET]
func (h *UserHandler) FindAll(c fiber.Ctx) error {
	return h.Handler.FindBy(c)
}

// Create godoc
//
//	@Summary		Create user
//	@Description	Create a new user.
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Param			user	body		CreateUserDTO	true	"User data"
//	@Success		200
//	@Failure		400	{object}	api.ErrorResponse
//	@Failure		500	{object}	api.ErrorResponse
//	@Router			/users [POST]
func (h *UserHandler) Create(c fiber.Ctx) error {
	return h.Handler.Create(c, &CreateUserDTO{})
}

// UpdateByID godoc
//
//	@Summary		Update user by ID
//	@Description	Update a user by ID.
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Param			id	path		string	true	"User ID"
//	@Param			user	body		CreateUserDTO	true	"User data"
//	@Success		200
//	@Failure		400	{object}	api.ErrorResponse
//	@Failure		500	{object}	api.ErrorResponse
//	@Router			/users/{id} [PUT]
func (h *UserHandler) UpdateByID(c fiber.Ctx) error {
	return h.Handler.UpdateByID(c, &CreateUserDTO{})
}

// DeleteByID godoc
//
//	@Summary		Delete user by ID
//	@Description	Delete a user by ID.
//	@Tags			users
//	@Produce		json
//	@Param			id	path		string	true	"User ID"
//	@Success		200
//	@Failure		400	{object}	api.ErrorResponse
//	@Failure		500	{object}	api.ErrorResponse
//	@Router			/users/{id} [DELETE]
func (h *UserHandler) DeleteByID(c fiber.Ctx) error {
	return h.Handler.DeleteByID(c)
}

func NewUserHandler(service *UserService, logger *logger.Logger) *UserHandler {
	return &UserHandler{
		Handler: crud.NewHandler(service.Service, logger),
	}
}
