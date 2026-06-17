package user

import (
	"context"

	"github.com/usesnipet/snipet/app/internal/crud"
	"github.com/usesnipet/snipet/app/internal/logger"
	"github.com/usesnipet/snipet/app/internal/model"
)

type UserService struct {
	*crud.Service[model.User]
}

func (s *UserService) Create(ctx context.Context, model *CreateUserDTO) error {
	return s.Service.Create(
		ctx,
		model.ToModel(),
	)
}

func NewUserService(repository *UserRepository, logger *logger.Logger) *UserService {
	return &UserService{
		Service: crud.NewService(repository.Repository, logger),
	}
}
