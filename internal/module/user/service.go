package user

import (
	"context"
	"errors"
	"net/http"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
)

// Service owns the users business logic. Authorization lives here (not in
// middleware): every method requires the caller to be an admin, and a
// Forbidden returned from here flows back as a normal *apperr.Error.
type Service struct {
	repo repository.IUserRepository
}

func NewService(repo repository.IUserRepository) *Service {
	return &Service{repo: repo}
}

// isNotFound reports whether err is an *apperr.Error with a 404 status.
func isNotFound(err error) bool {
	var appErr *apperr.Error
	return errors.As(err, &appErr) && appErr.StatusCode == http.StatusNotFound
}

// requireAdmin reads the caller from context and rejects non-admins.
func (s *Service) requireAdmin(ctx context.Context) error {
	caller, err := auth.CurrentUser(ctx)
	if err != nil {
		return err
	}
	if !caller.IsAdmin() {
		return apperr.Forbidden("admin role required")
	}
	return nil
}

func (s *Service) Filter(ctx context.Context, dto FindUsersFilterDTO) (*page.Paginated[model.User], error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.User, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto CreateUserDTO) (*model.User, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	role := model.Role(dto.Role)
	if !role.IsValid() {
		return nil, apperr.BadRequest("invalid role")
	}

	switch _, err := s.repo.FindByUsername(ctx, dto.Username); {
	case err == nil:
		return nil, apperr.Conflict("username already taken")
	case !isNotFound(err):
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
	if err := s.requireAdmin(ctx); err != nil {
		return err
	}

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
	if err := s.requireAdmin(ctx); err != nil {
		return err
	}

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
