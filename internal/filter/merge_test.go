package filter_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/filter"
)

func TestMergeCombinesWhereAndPreservesPagination(t *testing.T) {
	pagination := filter.New[User](
		filter.Take(10),
		filter.Skip(5),
		filter.OrderAsc("name"),
	)
	constraints := filter.New[User](
		filter.WhereEq("name", "John Doe"),
	)

	merged := filter.Merge(pagination, constraints)

	require.NoError(t, merged.Validate())
	assert.Equal(t, 10, merged.Take)
	assert.Equal(t, 5, merged.Skip)
	assert.Equal(t, filter.OrderDirectionAsc, merged.Order.Fields["name"])
	assert.Equal(t, filter.WhereOperatorEqual, merged.Where.Fields["name"].Operator)
	assert.Equal(t, []any{"John Doe"}, merged.Where.Fields["name"].Value)
}

func TestMergeLaterFilterOverridesSameField(t *testing.T) {
	first := filter.New[User](filter.WhereEq("name", "Alice"))
	second := filter.New[User](filter.WhereEq("name", "Bob"))

	merged := filter.Merge(first, second)

	assert.Equal(t, []any{"Bob"}, merged.Where.Fields["name"].Value)
}

func TestMergeLaterPaginationOverrides(t *testing.T) {
	first := filter.New[User](filter.Take(10), filter.Skip(5))
	second := filter.New[User](filter.Take(20), filter.Skip(0))

	merged := filter.Merge(first, second)

	assert.Equal(t, 20, merged.Take)
	assert.Equal(t, 0, merged.Skip)
}

func TestMergeEmptyReturnsDefaultState(t *testing.T) {
	merged := filter.Merge[User]()

	assert.Equal(t, 0, merged.Take)
	assert.Equal(t, 0, merged.Skip)
	assert.Empty(t, merged.Order.Fields)
	assert.Empty(t, merged.Where.Fields)
	assert.Empty(t, merged.Include)
}

func TestMergeUnionsIncludes(t *testing.T) {
	first := filter.New[Author](filter.Include("Profile"))
	second := filter.New[Author](filter.Include("Posts", "Profile"))

	merged := filter.Merge(first, second)

	assert.Equal(t, []string{"Profile", "Posts"}, merged.Include)
}

func TestFromInsideNew(t *testing.T) {
	base := filter.New[User](
		filter.Take(15),
		filter.Skip(3),
		filter.OrderDesc("name"),
	)

	opts := filter.New[User](
		filter.From(base),
		filter.WhereEq("name", "Jane"),
	)

	require.NoError(t, opts.Validate())
	assert.Equal(t, 15, opts.Take)
	assert.Equal(t, 3, opts.Skip)
	assert.Equal(t, filter.OrderDirectionDesc, opts.Order.Fields["name"])
	assert.Equal(t, []any{"Jane"}, opts.Where.Fields["name"].Value)
}
