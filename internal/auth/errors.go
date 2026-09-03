package auth

import "errors"

// ErrNotApplicable means a guard's credential was not present on the
// request (e.g. no X-API-Key header, no Bearer token). Returned by
// api.Gate implementations so guard.Or can skip to the next gate instead
// of failing the whole request.
var ErrNotApplicable = errors.New("auth not applicable")
