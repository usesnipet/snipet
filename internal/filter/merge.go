package filter

import "maps"

// From applies an existing Options onto the builder state.
// Pagination fields (Take, Skip) are only applied when the source filter
// carries pagination intent (non-zero Take, non-zero Skip, or any Order).
func From[T any](opts *Options[T]) Option {
	return func(s *state) {
		if opts == nil {
			return
		}

		hasPagination := opts.Take != 0 || opts.Skip != 0 || len(opts.Order.Fields) > 0
		if opts.Take != 0 {
			s.take = opts.Take
		}
		if hasPagination {
			s.skip = opts.Skip
		}

		maps.Copy(s.order.Fields, opts.Order.Fields)
		maps.Copy(s.where.Fields, opts.Where.Fields)
		s.include = appendUnique(s.include, opts.Include...)
	}
}

// Merge combines multiple filters into one. Order and Where fields are merged;
// when the same key appears in multiple filters, the last one wins.
// Include paths are unioned and deduplicated.
func Merge[T any](filters ...*Options[T]) *Options[T] {
	opts := make([]Option, 0, len(filters))
	for _, f := range filters {
		opts = append(opts, From(f))
	}
	return New[T](opts...)
}
