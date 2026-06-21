package user

import "github.com/usesnipet/snipet/app/internal/module/token"

type CreateAccountDTO struct {
	Nickname string `json:"nickname" validate:"required,min=3,max=255" mold:"trim,lcase"`
	Name     string `json:"name" validate:"required,min=3,max=255" mold:"trim"`
	Email    string `json:"email" validate:"required,email" mold:"trim,lcase"`
	Password string `json:"password" validate:"required,min=8,max=255"`
}

type LoginDTO struct {
	Account  string `json:"account" validate:"required,min=3,max=255" mold:"trim,lcase"`
	Password string `json:"password" validate:"required,min=8,max=255" mold:"trim"`
}

type LoginResponseDTO struct {
	Tokens   token.TokenResponseDTO `json:"tokens"`
	Email    string                 `json:"email"`
	Name     string                 `json:"name"`
	Nickname string                 `json:"nickname"`
	Role     string                 `json:"role"`
}

type CreateAccountResponseDTO struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	CreatedAt string `json:"createdAt"`
}
