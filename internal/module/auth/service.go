package auth

import (
	"context"

	"github.com/usesnipet/snipet/config"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	coreauth "github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/repository"
)

// Service owns login and self-service account operations. Authorization
// for /auth/me* is "any authenticated caller" — guard.RequireUserJWT alone,
// no guard.RequireRole — so, like the users module, this service takes no
// position on roles; it only ever acts on the caller's own account.
type Service struct {
	repo       repository.IUserRepository
	jwtService *coreauth.JWTService
	authConfig config.AuthConfig
}

func NewService(
	repo repository.IUserRepository,
	jwtService *coreauth.JWTService,
	authConfig config.AuthConfig,
) *Service {
	return &Service{repo: repo, jwtService: jwtService, authConfig: authConfig}
}

// Login verifies username+password and issues a JWT. Returns the same
// Unauthorized for "no such user" and "wrong password".
func (s *Service) Login(ctx context.Context, dto LoginDTO) (*LoginResponse, error) {
	user, err := s.repo.FindByUsername(ctx, dto.Username)
	if err != nil {
		return nil, apperr.Unauthorized("invalid credentials")
	}

	if err := coreauth.ComparePassword(user.Password, dto.Password); err != nil {
		return nil, apperr.Unauthorized("invalid credentials")
	}

	token, expiresAt, err := s.jwtService.GenerateToken(user)
	if err != nil {
		return nil, apperr.InternalServerError("failed to issue token")
	}

	return &LoginResponse{
		AccessToken:          token,
		AccessTokenExpiresAt: expiresAt,
		User:                 *user,
	}, nil
}

// Me returns the caller's own profile.
func (s *Service) Me(ctx context.Context, userID string) (*model.User, error) {
	return s.repo.FindByID(ctx, userID)
}

// ChangeOwnPassword verifies current_password before persisting the new
// hash — the bearer token alone isn't enough to change your own password.
func (s *Service) ChangeOwnPassword(ctx context.Context, userID string, dto ChangeOwnPasswordDTO) error {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	if err := coreauth.ComparePassword(user.Password, dto.CurrentPassword); err != nil {
		return apperr.Unauthorized("current password is incorrect")
	}

	hash, err := coreauth.HashPassword(dto.NewPassword)
	if err != nil {
		return apperr.InternalServerError("failed to hash password")
	}

	return s.repo.UpdateByID(ctx, userID, &model.User{Password: hash})
}
