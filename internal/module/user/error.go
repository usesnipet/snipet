package user

import "errors"

var (
	ErrUserEmailAlreadyExists    = errors.New("email already in use")
	ErrUserNicknameAlreadyExists = errors.New("nickname already in use")
	ErrInvalidCredentials        = errors.New("invalid credentials")
	ErrRequiredFields            = errors.New("required fields are missing")
	ErrUserNotFound              = errors.New("user not found")
)
