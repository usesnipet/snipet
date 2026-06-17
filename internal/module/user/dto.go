package user

import "github.com/usesnipet/snipet/app/internal/model"

// CreateUserDTO represents the payload to create a user.
type CreateUserDTO struct {
	Name     string     `json:"name" validate:"required"`
	Email    string     `json:"email" validate:"required,email"`
	Password string     `json:"password" validate:"required"`
	Role     model.Role `json:"role" validate:"required,oneof=user admin"`
}

func (dto *CreateUserDTO) ToModel() *model.User {
	return &model.User{
		Name:     dto.Name,
		Email:    dto.Email,
		Password: dto.Password,
		Role:     dto.Role,
	}
}
