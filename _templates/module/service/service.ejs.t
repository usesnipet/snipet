---
to: internal/module/<%= h.kebab(mod) %>/<%= file %>.go
unless_exists: true
sh: gofmt -w internal/module/<%= h.kebab(mod) %>/<%= file %>.go
---
<% const M = h.pascal(mod); -%>
package <%= h.pkgName(mod) %>

import (
	"context"

	"<%= h.goModule() %>/internal/model"
	"<%= h.goModule() %>/internal/repository"
)

// <%= structName %> groups the <%= file %> operations of the <%= h.kebab(mod) %> module.
// A module can hold several services like this, one per cohesive set of behaviour.
type <%= structName %> struct {
	repo repository.I<%= M %>Repository
}

func <%= ctorName %>(repo repository.I<%= M %>Repository) *<%= structName %> {
	return &<%= structName %>{repo: repo}
}

// FindByID is a starting point — add the methods this service needs.
func (s *<%= structName %>) FindByID(ctx context.Context, id string) (*model.<%= M %>, error) {
	return s.repo.FindByID(ctx, id)
}
