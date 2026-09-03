---
to: internal/module/<%= h.kebab(mod) %>/service.go
inject: true
append: true
skip_if: func \(s \*Service\) <%= h.pascal(method) %>\(
sh: gofmt -w internal/module/<%= h.kebab(mod) %>/service.go
---
<% const P = h.pascal(mod); -%>

<% if (kind === 'query') { -%>
func (s *Service) <%= h.pascal(method) %>(ctx context.Context, id string) (*model.<%= P %>, error) {
	// TODO: implement <%= h.pascal(method) %>
	return s.repo.FindByID(ctx, id)
}
<% } else { -%>
func (s *Service) <%= h.pascal(method) %>(ctx context.Context, id string) error {
	// TODO: implement <%= h.pascal(method) %>
	if _, err := s.repo.FindByID(ctx, id); err != nil {
		return err
	}
	return nil
}
<% } -%>
