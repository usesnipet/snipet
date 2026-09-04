package api

import (
	"github.com/usesnipet/snipet/internal/model"
)

// RoleGate is RequireRole's shape: a factory a handler calls with the
// specific roles *that route group* needs, rather than a single api.Gate
// pre-built with fixed roles in bootstrap. Bootstrap builds the factory
// once and hands it to every module that needs role authorization; each
// module's handler.go decides its own roles per route group.
type RoleGate func(roles ...model.Role) Gate
