package system

import (
	"github.com/usesnipet/snipet/version"
)

type Service struct {
}

func NewService() *Service {
	return &Service{}
}

// Info exposes the version of the server.
func (s *Service) Info() *InfoDTO {
	return &InfoDTO{
		Version: version.Version,
	}
}
