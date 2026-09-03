package auth

import "errors"

var (
	ErrHashPassword    = errors.New("hash password")
	ErrComparePassword = errors.New("compare password")
)
