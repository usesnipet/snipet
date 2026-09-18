package user

import (
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
)

// UserResponse is the model returned directly.
type UserResponse = model.User

type UsersPage = page.Paginated[model.User]

// CreateUserDTO is the POST body.
type CreateUserDTO struct {
	Username string `json:"username" validate:"required,max=255"`
	Name     string `json:"name" validate:"required,max=255"`
	Password string `json:"password" validate:"required,min=8,max=255"`
	Role     string `json:"role" validate:"required"`
}

// UpdateUserDTO is the PUT body.
type UpdateUserDTO struct {
	Name     *string `json:"name" validate:"omitempty,max=255"`
	Password *string `json:"password" validate:"omitempty,min=8,max=255"`
	Role     *string `json:"role" validate:"omitempty"`
}

// FindUsersFilterDTO is the list query string.
type FindUsersFilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *FindUsersFilterDTO) ToFilter() *filter.Options[model.User] {
	return filter.New[model.User](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
