package guard

import (
	"net/http"
	"strings"

	"github.com/usesnipet/snipet/internal/auth"
)

// verifyBearerJWT extracts and verifies an "Authorization: Bearer ..."
// token. Returns auth.ErrNotApplicable when the header is absent, so gates
// built on it compose cleanly with Or.
func verifyBearerJWT(r *http.Request, jwtService *auth.JWTService) (*auth.UserClaims, error) {
	token := r.Header.Get("Authorization")
	if !strings.HasPrefix(token, "Bearer ") {
		return nil, auth.ErrNotApplicable
	}

	return jwtService.VerifyToken(token)
}
