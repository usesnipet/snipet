package filter_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/go-template/internal/filter"
)

type User struct {
	ID   int
	Name string
}

type Profile struct {
	ID       int
	AuthorID int
	Bio      string
}

type Post struct {
	ID       int
	AuthorID int
	Title    string
	Author   Author `gorm:"foreignKey:AuthorID"`
}

type Author struct {
	ID      int
	Name    string
	Profile Profile `gorm:"foreignKey:AuthorID"`
	Posts   []Post  `gorm:"foreignKey:AuthorID"`
}

func TestValidateFieldNamesRejectsSQLInjection(t *testing.T) {
	opts := filter.New[User](
		filter.WhereEq("name; DROP TABLE users;--", "John Doe"),
	)

	err := opts.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid field name")
}

func TestValidateFieldNamesRejectsUnknownColumn(t *testing.T) {
	opts := filter.New[User](
		filter.WhereEq("unknown", "value"),
	)

	err := opts.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown field")
}

func TestValidateFieldNamesAllowsKnownColumn(t *testing.T) {
	opts := filter.New[User](
		filter.WhereEq("name", "John Doe"),
	)

	err := opts.Validate()
	require.NoError(t, err)
}

func TestValidateIncludesAllowsKnownAssociation(t *testing.T) {
	opts := filter.New[Author](filter.Include("Profile", "Posts"))

	err := opts.Validate()
	require.NoError(t, err)
}

func TestValidateIncludesRejectsUnknownAssociation(t *testing.T) {
	opts := filter.New[Author](filter.Include("Unknown"))

	err := opts.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown include")
}

func TestValidateIncludesRejectsInvalidSegment(t *testing.T) {
	opts := filter.New[Author](filter.Include("Profile; DROP TABLE"))

	err := opts.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid include path segment")
}

func TestValidateIncludesAllowsNestedAssociation(t *testing.T) {
	opts := filter.New[Author](filter.Include("Posts.Author"))

	err := opts.Validate()
	require.NoError(t, err)
}
