package auth

// UserClaims is an example concrete claims type. Each module that issues
// JWTs defines its own claims struct the same way: embed BaseClaims and add
// whatever fields that module needs, then use it as the type parameter of
// JWTService[T].
type UserClaims struct {
	BaseClaims

	Scope string `json:"scope,omitempty"`
}
