// Package set provides a minimal generic set built on top of a Go map.
package set

// Set is an unordered collection of unique comparable values, backed by a
// map for O(1) Add/Remove/Contains.
type Set[T comparable] map[T]struct{}

// Add inserts value into the set. It is a no-op if value is already present.
func (s Set[T]) Add(value T) {
	s[value] = struct{}{}
}

// Remove deletes value from the set. It is a no-op if value is not present.
func (s Set[T]) Remove(value T) {
	delete(s, value)
}

// Contains reports whether value is in the set.
func (s Set[T]) Contains(value T) bool {
	_, ok := s[value]
	return ok
}

// Size returns the number of values in the set.
func (s Set[T]) Size() int {
	return len(s)
}

// New builds a Set containing the given values.
func New[T comparable](values ...T) Set[T] {
	s := make(Set[T])
	for _, value := range values {
		s.Add(value)
	}
	return s
}
