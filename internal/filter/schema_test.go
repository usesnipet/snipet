package filter_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/app/internal/filter"
)

type User struct {
	ID   int
	Name string
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
