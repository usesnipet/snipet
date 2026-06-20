package user

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/usesnipet/snipet/app/internal/api"
	"github.com/usesnipet/snipet/app/internal/auth"
	"github.com/usesnipet/snipet/app/internal/filter"
	"github.com/usesnipet/snipet/app/internal/model"
	"github.com/usesnipet/snipet/app/internal/module/token"
)

type Service struct {
	repository   *Repository
	tokenService *token.Service
}

func (s *Service) CreateAccount(
	ctx context.Context,
	dto CreateAccountDTO,
	role model.Role,
) (CreateAccountResponseDTO, error) {
	password := dto.Password

	withEmail, err := s.repository.FindBy(
		ctx,
		filter.New[model.User](
			filter.Take(1),
			filter.WhereEq("email", dto.Email),
		),
	)
	if withEmail.Count() > 0 {
		return CreateAccountResponseDTO{}, api.NewError(http.StatusBadRequest, ErrUserEmailAlreadyExists)
	}

	withNickname, err := s.repository.FindBy(
		ctx,
		filter.New[model.User](
			filter.Take(1),
			filter.WhereEq("nickname", dto.Nickname),
		),
	)
	if withNickname.Count() > 0 {
		return CreateAccountResponseDTO{}, api.NewError(http.StatusBadRequest, ErrUserNicknameAlreadyExists)
	}

	hashedPassword, err := auth.HashPassword(password)
	if err != nil {
		return CreateAccountResponseDTO{}, err
	}

	user := &model.User{
		Nickname: dto.Nickname,
		Name:     dto.Name,
		Email:    dto.Email,
		Password: hashedPassword,
		Role:     role,
	}

	if err := s.repository.Create(ctx, user); err != nil {
		return CreateAccountResponseDTO{}, err
	}

	return CreateAccountResponseDTO{
		ID:        user.ID.String(),
		Nickname:  user.Nickname,
		Name:      user.Name,
		Email:     user.Email,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (s *Service) Login(ctx context.Context, dto LoginDTO) (LoginResponseDTO, error) {
	user, err := s.repository.FindByAccount(ctx, dto.Account)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return LoginResponseDTO{}, api.NewError(http.StatusUnauthorized, ErrInvalidCredentials)
		}
		return LoginResponseDTO{}, err
	}

	if err := auth.ComparePassword(user.Password, dto.Password); err != nil {
		return LoginResponseDTO{}, api.NewError(http.StatusUnauthorized, ErrInvalidCredentials)
	}

	token, expiresAt, err := s.tokenService.Generate(user)
	if err != nil {
		return LoginResponseDTO{}, err
	}

	return LoginResponseDTO{
		Token:     token,
		ExpiresAt: expiresAt.Format(time.RFC3339),
		Email:     user.Email,
		Name:      user.Name,
		Nickname:  user.Nickname,
		Role:      string(user.Role),
	}, nil
}

func NewService(repository *Repository, tokenService *token.Service) *Service {
	return &Service{
		repository:   repository,
		tokenService: tokenService,
	}
}
