package auth

import (
	"time"

	"github.com/usesnipet/snipet/internal/model"
)

// MeResponse is the caller's own profile
type MeResponse = model.User

// LoginDTO is the POST /auth/login body.
type LoginDTO struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

// LoginResponse carries the issued token plus the logged-in user (without
// its password hash) and refresh token.
type LoginResponse struct {
	AccessToken           string     `json:"access_token"`
	AccessTokenExpiresAt  time.Time  `json:"expires_at"`
	RefreshToken          string     `json:"refresh_token"`
	RefreshTokenExpiresAt time.Time  `json:"refresh_expires_at"`
	User                  model.User `json:"user"`
}

// ChangeOwnPasswordDTO is the PUT /auth/me/password body.
type ChangeOwnPasswordDTO struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8,max=255"`
}
