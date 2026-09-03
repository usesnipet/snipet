---
to: internal/module/<%= h.kebab(name) %>/service.go
sh: gofmt -w internal/module/<%= h.kebab(name) %>/service.go
---
<% const P = h.pascal(name); const Plural = h.pluralPascal(name); -%>
package <%= h.pkgName(name) %>

import (
	"context"

	"<%= h.goModule() %>/internal/model"
	"<%= h.goModule() %>/internal/page"
	"<%= h.goModule() %>/internal/repository"
)

// Service owns the <%= h.kebab(name) %> business logic. It depends on the repository
// interface (never the concrete type) so it is mockable in tests.
type Service struct {
	repo repository.I<%= P %>Repository
}

func NewService(repo repository.I<%= P %>Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Filter(ctx context.Context, dto Find<%= Plural %>FilterDTO) (*page.Paginated[model.<%= P %>], error) {
	return s.repo.Filter(ctx, dto.ToFilter())
}

func (s *Service) FindByID(ctx context.Context, id string) (*model.<%= P %>, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, dto Create<%= P %>DTO) (*model.<%= P %>, error) {
	entity := &model.<%= P %>{
<% goFields.forEach(function (f) { -%>
		<%= f.goName %>: dto.<%= f.goName %>,
<% }); -%>
	}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

// Update applies only the fields the caller set (non-nil pointers). A field
// left at its zero value is omitted from the SQL SET clause by GORM.
func (s *Service) Update(ctx context.Context, id string, dto Update<%= P %>DTO) error {
	if _, err := s.repo.FindByID(ctx, id); err != nil {
		return err
	}

	updates := &model.<%= P %>{}
<% goFields.forEach(function (f) { -%>
	if dto.<%= f.goName %> != nil {
<% if (f.jsonMap) { -%>
		updates.<%= f.goName %> = dto.<%= f.goName %>
<% } else { -%>
		updates.<%= f.goName %> = *dto.<%= f.goName %>
<% } -%>
	}
<% }); -%>
	return s.repo.UpdateByID(ctx, id, updates)
}

func (s *Service) DeleteByID(ctx context.Context, id string) error {
	return s.repo.DeleteByID(ctx, id)
}
