package filter

type Option func(*state)

type state struct {
	take    int
	skip    int
	order   OrderOptions
	where   WhereOptions
	include []string
}

func newState() *state {
	return &state{
		order: OrderOptions{Fields: make(map[string]OrderDirection)},
		where: WhereOptions{Fields: make(map[string]WhereFieldOptions)},
	}
}

func appendUnique(dst []string, paths ...string) []string {
	seen := make(map[string]struct{}, len(dst)+len(paths))
	for _, p := range dst {
		seen[p] = struct{}{}
	}
	for _, p := range paths {
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		dst = append(dst, p)
	}
	return dst
}

func toOptions[T any](s *state) *Options[T] {
	return &Options[T]{
		Take:    s.take,
		Skip:    s.skip,
		Order:   s.order,
		Where:   s.where,
		Include: s.include,
	}
}

func New[T any](opts ...Option) *Options[T] {
	s := newState()
	for _, opt := range opts {
		opt(s)
	}
	return toOptions[T](s)
}

func Default[T any]() *Options[T] {
	return New[T](
		Take(2000),
		Skip(0),
	)
}

func Take(n int) Option {
	return func(s *state) {
		s.take = n
	}
}
func PtrTake(n *int) Option {
	return func(s *state) {
		if n != nil {
			s.take = *n
		}
	}
}
func Skip(n int) Option {
	return func(s *state) {
		s.skip = n
	}
}
func PtrSkip(n *int) Option {
	return func(s *state) {
		if n != nil {
			s.skip = *n
		}
	}
}

func OrderBy(field string, direction OrderDirection) Option {
	return func(s *state) {
		s.order.Fields[field] = direction
	}
}
func PtrOrderBy(field string, direction *OrderDirection) Option {
	return func(s *state) {
		if direction != nil {
			s.order.Fields[field] = *direction
		}
	}
}

func OrderAsc(field string) Option {
	return OrderBy(field, OrderDirectionAsc)
}
func PtrOrderAsc(field *string) Option {
	return func(s *state) {
		if field != nil {
			OrderBy(*field, OrderDirectionAsc)
		}
	}
}

func OrderDesc(field string) Option {
	return OrderBy(field, OrderDirectionDesc)
}
func PtrOrderDesc(field *string) Option {
	return func(s *state) {
		if field != nil {
			OrderBy(*field, OrderDirectionDesc)
		}
	}
}

func Where(field string, operator WhereOperator, values ...any) Option {
	return func(s *state) {
		s.where.Fields[field] = WhereFieldOptions{
			Operator: operator,
			Value:    values,
		}
	}
}

func WhereEq(field string, value any) Option {
	return Where(field, WhereOperatorEqual, value)
}

func WhereNeq(field string, value any) Option {
	return Where(field, WhereOperatorNotEqual, value)
}

func WhereGt(field string, value any) Option {
	return Where(field, WhereOperatorGreaterThan, value)
}

func WhereGte(field string, value any) Option {
	return Where(field, WhereOperatorGreaterThanOrEqual, value)
}

func WhereLt(field string, value any) Option {
	return Where(field, WhereOperatorLessThan, value)
}

func WhereLte(field string, value any) Option {
	return Where(field, WhereOperatorLessThanOrEqual, value)
}

func WhereLike(field string, value any) Option {
	return Where(field, WhereOperatorLike, value)
}

func WhereIn(field string, values ...any) Option {
	return Where(field, WhereOperatorIn, values...)
}

func WhereNotIn(field string, values ...any) Option {
	return Where(field, WhereOperatorNotIn, values...)
}

func WhereBetween(field string, from, to any) Option {
	return Where(field, WhereOperatorBetween, from, to)
}

func WhereIsNull(field string) Option {
	return Where(field, WhereOperatorIsNull)
}

func WhereIsNotNull(field string) Option {
	return Where(field, WhereOperatorIsNotNull)
}

func Include(paths ...string) Option {
	return func(s *state) {
		s.include = appendUnique(s.include, paths...)
	}
}
