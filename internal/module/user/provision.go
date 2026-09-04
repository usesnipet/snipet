package user

import (
	"context"

	"github.com/usesnipet/snipet/config"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/repository"
)

// EnsureRoot creates a root admin account when the users table is empty.
// Idempotent — guarded purely by "zero users exist", so it's safe to call
// on every boot; once any user exists (root or otherwise) it's a no-op.
func EnsureRoot(ctx context.Context, repo repository.IUserRepository, cfg config.AuthConfig) (created bool, err error) {
	count, err := repo.CountAll(ctx)
	if err != nil {
		return false, err
	}
	if count > 0 {
		return false, nil
	}

	hash, err := auth.HashPassword(cfg.RootPassword)
	if err != nil {
		return false, err
	}

	root := &model.User{
		Username: cfg.RootUsername,
		Name:     "Root",
		Password: hash,
		Role:     model.RoleAdmin,
	}
	if err := repo.Create(ctx, root); err != nil {
		return false, err
	}

	return true, nil
}

// ResetRoot regenerates the root account's password to a random value and
// persists the hash, returning the plaintext once so the caller can log
// it — it is never persisted or logged anywhere else. found is false
// (a no-op) when no user matches cfg.RootUsername.
func ResetRoot(ctx context.Context, repo repository.IUserRepository, cfg config.AuthConfig) error {
	root, err := repo.FindByUsername(ctx, cfg.RootUsername)
	if err != nil {
		return err
	}

	hash, err := auth.HashPassword(cfg.RootPassword)
	if err != nil {
		return err
	}

	if err := repo.UpdateByID(ctx, root.ID, &model.User{Password: hash}); err != nil {
		return err
	}

	return nil
}
