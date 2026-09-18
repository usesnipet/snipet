package user

import (
	"context"
	"net/http"

	"github.com/usesnipet/snipet/config"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/logger"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
)

// Service owns the users business logic.
type Service struct {
	repo repository.IUserRepository
	log  *logger.Logger
}

func NewService(repo repository.IUserRepository, log *logger.Logger) *Service {
	return &Service{repo: repo, log: log}
}

func (s *Service) InitializeRootUser(ctx context.Context, cfg config.AuthConfig) error {
	rootCreated, err := EnsureRoot(ctx, s.repo, cfg)
	if err != nil {
		s.log.Errorf("failed to provision root user: %v", err)
		return err
	}
	if rootCreated {
		s.log.Infof("created root user %q (role admin)", cfg.RootUsername)
	}

	if cfg.RootPasswordReset && !rootCreated {
		if err := ResetRoot(ctx, s.repo, cfg); err != nil {
			s.log.Errorf("failed to reset root password: %v", err)
			return err
		} else {
			s.log.Warnf(
				"reset root password for user %q \ndisable AUTH_ROOT_PASSWORD_RESET and restart the server",
				cfg.RootUsername,
			)
		}
	}

	return nil
}

func (s *Service) Filter(ctx context.Context, dto FindUsersFilterDTO) (*page.Paginated[model.User], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.User, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto CreateUserDTO) (*model.User, error) {
	role := model.Role(dto.Role)
	if !role.IsValid() {
		return nil, apperr.BadRequest("invalid role")
	}

	switch _, err := s.repo.FindByUsername(ctx, dto.Username); {
	case err == nil:
		return nil, apperr.Conflict("username already taken")
	case !apperr.Is(err, http.StatusNotFound):
		return nil, err
	}

	hash, err := auth.HashPassword(dto.Password)
	if err != nil {
		return nil, apperr.InternalServerError("failed to hash password")
	}

	entity := &model.User{
		Username: dto.Username,
		Name:     dto.Name,
		Password: hash,
		Role:     role,
	}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

// Update applies only the fields the caller set (non-nil pointers). Guards
// against demoting the last remaining admin.
func (s *Service) Update(ctx context.Context, id string, dto UpdateUserDTO) error {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}

	updates := &model.User{}
	if dto.Name != nil {
		updates.Name = *dto.Name
	}
	if dto.Role != nil {
		role := model.Role(*dto.Role)
		if !role.IsValid() {
			return apperr.BadRequest("invalid role")
		}
		if existing.Role == model.RoleAdmin && role != model.RoleAdmin {
			if err := s.ensureNotLastAdmin(ctx); err != nil {
				return err
			}
		}
		updates.Role = role
	}
	if dto.Password != nil {
		hash, err := auth.HashPassword(*dto.Password)
		if err != nil {
			return apperr.InternalServerError("failed to hash password")
		}
		updates.Password = hash
	}

	return s.repo.UpdateByID(ctx, id, updates)
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing.Role == model.RoleAdmin {
		if err := s.ensureNotLastAdmin(ctx); err != nil {
			return err
		}
	}

	return s.repo.DeleteByID(ctx, id)
}

// ensureNotLastAdmin returns Forbidden when only one admin remains.
func (s *Service) ensureNotLastAdmin(ctx context.Context) error {
	count, err := s.repo.CountByRole(ctx, model.RoleAdmin)
	if err != nil {
		return err
	}
	if count <= 1 {
		return apperr.Forbidden("cannot remove the last remaining admin")
	}
	return nil
}
