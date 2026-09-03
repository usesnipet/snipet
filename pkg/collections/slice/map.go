// Package slice provides small generic helpers for working with slices.
package slice

// Map applies fn to each element of slice, returning a new slice of the
// results in the same order.
func Map[T any, R any](slice []T, fn func(T) R) []R {
	result := make([]R, len(slice))
	for i, v := range slice {
		result[i] = fn(v)
	}
	return result
}
