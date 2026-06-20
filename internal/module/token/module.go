package token

import (
	"go.uber.org/fx"
)

var Module = fx.Module("token",
	fx.Provide(NewService),
)
