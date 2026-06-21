package token

import "time"

type Token struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type TokenResponseDTO struct {
	AccessToken  Token `json:"accessToken"`
	RefreshToken Token `json:"refreshToken"`
}
