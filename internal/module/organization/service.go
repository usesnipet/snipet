package organization

import (
	"context"
	"net/http"

	"github.com/usesnipet/snipet/app/internal/api"
	"github.com/usesnipet/snipet/app/internal/filter"
	"github.com/usesnipet/snipet/app/internal/infra/database"
	"github.com/usesnipet/snipet/app/internal/model"
)

type Service struct {
	repository *Repository
}

func (s *Service) Create(ctx context.Context, dto CreateOrganizationDTO) error {
	orgs, err := s.repository.FindBy(
		ctx,
		filter.New[model.Organization](
			filter.Take(1),
			filter.WhereEq("slug", dto.Slug),
		),
	)
	if err != nil {
		return err
	}
	if len(orgs.Data) > 0 {
		return api.NewError(
			http.StatusBadRequest,
			ErrOrganizationSlugAlreadyExists,
		)
	}

	return s.repository.Create(ctx, &model.Organization{
		Slug: dto.Slug,
		Name: dto.Name,
	})
}

func (s *Service) Update(ctx context.Context, id string, dto UpdateOrganizationDTO) error {
	return s.repository.UpdateByID(ctx, id, &model.Organization{
		Name: dto.Name,
	})
}

func (s *Service) FindByID(ctx context.Context, id string) (model.Organization, error) {
	return s.repository.FindByID(ctx, id)
}

func (s *Service) FindBy(
	ctx context.Context,
	filter *filter.Options[model.Organization],
) (*database.Paginated[model.Organization], error) {
	return s.repository.FindBy(ctx, filter)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repository.DeleteByID(ctx, id)
}

func NewService(repository *Repository) *Service {
	return &Service{repository: repository}
}
