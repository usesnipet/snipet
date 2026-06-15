package user

import (
	"context"

	"github.com/usesnipet/go-template/internal/crud"
	"github.com/usesnipet/go-template/internal/logger"
	"github.com/usesnipet/go-template/internal/model"
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
