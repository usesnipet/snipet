package model

import "time"

// Role is the small typed enum of user roles. Only two roles exist; the
// single behavioral difference is that RoleAdmin can manage other users.
type Role string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

// IsValid reports whether r is one of the known roles.
func (r Role) IsValid() bool {
	switch r {
	case RoleAdmin, RoleUser:
		return true
	default:
		return false
	}
}

// User is the persistence shape of the users domain — an operator that can
// log in with a username + password. Password reset by email is out of
// scope, so there is no email field.
// Keep the gorm tags in sync with migrations/ — schema is generated from
// this struct by Atlas (see docs/backend/migrations.md), never hand-written.
type User struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	// Username is the login handle — unique, case-sensitive.
	Username string `gorm:"type:varchar(255);not null;uniqueIndex" json:"username"`

	// Name is the display name.
	Name string `gorm:"type:varchar(255);not null" json:"name"`

	// Password is the bcrypt hash. json:"-" so it never serializes — no
	// list or get-by-id response ever carries it.
	Password string `gorm:"type:varchar(255);not null" json:"-"`

	// Role is one of RoleAdmin | RoleUser.
	Role Role `gorm:"type:varchar(32);not null" json:"role"`

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}
