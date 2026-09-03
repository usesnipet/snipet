package slice_test

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/usesnipet/snipet/pkg/collections/slice"
)

func TestMapTransformsEachElement(t *testing.T) {
	result := slice.Map([]int{1, 2, 3}, func(n int) string {
		return strconv.Itoa(n)
	})

	assert.Equal(t, []string{"1", "2", "3"}, result)
}

func TestMapReturnsEmptySliceForEmptyInput(t *testing.T) {
	result := slice.Map([]int{}, func(n int) int {
		return n * 2
	})

	assert.Empty(t, result)
	assert.NotNil(t, result)
}

func TestMapPreservesOrder(t *testing.T) {
	result := slice.Map([]string{"c", "a", "b"}, func(s string) string {
		return s + s
	})

	assert.Equal(t, []string{"cc", "aa", "bb"}, result)
}

func TestMapSupportsTypeConversion(t *testing.T) {
	type user struct {
		Name string
	}

	result := slice.Map([]user{
		{Name: "Alice"},
		{Name: "Bob"},
	}, func(u user) string {
		return u.Name
	})

	assert.Equal(t, []string{"Alice", "Bob"}, result)
}

func TestMapResultHasSameLengthAsInput(t *testing.T) {
	input := []int{10, 20, 30, 40, 50}

	result := slice.Map(input, func(n int) int {
		return n + 1
	})

	assert.Len(t, result, len(input))
}
