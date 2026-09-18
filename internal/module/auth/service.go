package auth

import (
	"context"
	"time"

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
	repo                 repository.IUserRepository
	jwtService           *coreauth.JWTService
	userRefreshTokenRepo repository.IRefreshTokenRepository
	tokenService         *coreauth.TokenService
	authConfig           config.AuthConfig
}

func NewService(
	repo repository.IUserRepository,
	jwtService *coreauth.JWTService,
	authConfig config.AuthConfig,
	userRefreshTokenRepo repository.IRefreshTokenRepository,
	tokenService *coreauth.TokenService,
) *Service {
	return &Service{
		repo:                 repo,
		jwtService:           jwtService,
		userRefreshTokenRepo: userRefreshTokenRepo,
		tokenService:         tokenService,
		authConfig:           authConfig,
	}
}

func (s *Service) issueTokens(ctx context.Context, user *model.User) (*AuthResponse, error) {
	accessToken, accessTokenExpiresAt, err := s.jwtService.GenerateToken(user)
	if err != nil {
		return nil, apperr.InternalServerError("failed to issue token")
	}
	refreshToken, err := s.tokenService.GenerateToken()
	if err != nil {
		return nil, err
	}

	record := &model.RefreshToken{
		Hash:      s.tokenService.HashToken(refreshToken),
		ExpiresAt: time.Now().Add(s.authConfig.RefreshTokenExpiration),
		UserID:    user.ID,
	}
	if err := s.userRefreshTokenRepo.Create(ctx, record); err != nil {
		return nil, err
	}

	return &AuthResponse{
		AccessToken:           accessToken,
		AccessTokenExpiresAt:  accessTokenExpiresAt,
		RefreshToken:          refreshToken,
		RefreshTokenExpiresAt: record.ExpiresAt,
		User:                  *user,
	}, nil
}

// Login verifies username+password and issues a JWT. Returns the same
// Unauthorized for "no such user" and "wrong password".
func (s *Service) Login(ctx context.Context, dto LoginDTO) (*AuthResponse, error) {
	user, err := s.repo.FindByUsername(ctx, dto.Username)
	if err != nil {
		return nil, apperr.Unauthorized("invalid credentials")
	}

	if err := coreauth.ComparePassword(user.Password, dto.Password); err != nil {
		return nil, apperr.Unauthorized("invalid credentials")
	}

	return s.issueTokens(ctx, user)
}

// Me returns the caller's own profile.
func (s *Service) Me(ctx context.Context, userID string) (*model.User, error) {
	return s.repo.FindByID(ctx, userID)
}

// ChangeOwnPassword verifies current_password before persisting the new
// hash — the bearer token alone isn't enough to change your own password.
// Revokes every outstanding refresh token afterwards, so a token issued
// before the change (stolen or not) can't outlive it.
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

	if err := s.repo.UpdateByID(ctx, userID, &model.User{Password: hash}); err != nil {
		return err
	}

	return s.userRefreshTokenRepo.RevokeAllByUserID(ctx, userID)
}

// Refresh trades a still-valid, unrevoked refresh token for a new
// access+refresh token pair, then revokes the one it was given — each
// refresh token is single-use, so a stolen one can't be replayed once the
// legitimate caller has refreshed with it.
func (s *Service) Refresh(ctx context.Context, dto RefreshTokenDTO) (*AuthResponse, error) {
	record, err := s.findActiveRefreshToken(ctx, dto.RefreshToken)
	if err != nil {
		return nil, err
	}

	user, err := s.repo.FindByID(ctx, record.UserID)
	if err != nil {
		return nil, apperr.Unauthorized("invalid refresh token")
	}

	response, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, err
	}

	if err := s.userRefreshTokenRepo.RevokeByID(ctx, record.ID); err != nil {
		return nil, err
	}

	return response, nil
}

// Logout revokes the given refresh token. Idempotent — an already-gone or
// already-revoked token is not an error, it just means there's nothing left
// to log out of.
func (s *Service) Logout(ctx context.Context, dto RefreshTokenDTO) error {
	record, err := s.userRefreshTokenRepo.FindByHash(ctx, s.tokenService.HashToken(dto.RefreshToken))
	if err != nil {
		return nil
	}
	return s.userRefreshTokenRepo.RevokeByID(ctx, record.ID)
}

// findActiveRefreshToken looks up a refresh token by its plaintext value
// and rejects it unless it's neither expired nor revoked.
func (s *Service) findActiveRefreshToken(ctx context.Context, plaintext string) (*model.RefreshToken, error) {
	record, err := s.userRefreshTokenRepo.FindByHash(ctx, s.tokenService.HashToken(plaintext))
	if err != nil {
		return nil, apperr.Unauthorized("invalid refresh token")
	}
	if record.RevokedAt != nil || time.Now().After(record.ExpiresAt) {
		return nil, apperr.Unauthorized("invalid refresh token")
	}
	return record, nil
}
