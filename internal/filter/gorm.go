package filter

import (
	"gorm.io/gorm"
)

type GormOptions struct {
	AllowWhere    bool
	AllowPreload  bool
	AllowPaginate bool
	AllowOrder    bool
}

type GormOptionsFunc func(options *GormOptions)

func WithAllowWhere(allow bool) GormOptionsFunc {
	return func(options *GormOptions) {
		options.AllowWhere = allow
	}
}

func WithAllowPreload(allow bool) GormOptionsFunc {
	return func(options *GormOptions) {
		options.AllowPreload = allow
	}
}

func WithAllowPaginate(allow bool) GormOptionsFunc {
	return func(options *GormOptions) {
		options.AllowPaginate = allow
	}
}

func WithAllowOrder(allow bool) GormOptionsFunc {
	return func(options *GormOptions) {
		options.AllowOrder = allow
	}
}

func (f *Options[T]) ToGorm(gormInterface gorm.Interface[T], optionsFuncs ...GormOptionsFunc) (gorm.ChainInterface[T], error) {
	options := DefaultGormOptions()
	for _, optionFunc := range optionsFuncs {
		optionFunc(options)
	}

	if err := f.Validate(); err != nil {
		return nil, err
	}

	take := f.Take
	if take <= 0 {
		take = -1
	}
	chain := gormInterface.Limit(take).Offset(f.Skip)
	if !options.AllowPaginate {
		chain = chain.Limit(-1).Offset(-1)
	}

	if options.AllowOrder {
		for field, value := range f.Order.Fields {
			chain = chain.Order(field + " " + string(value))
		}
	}

	if options.AllowWhere {
		for field, value := range f.Where.Fields {
			switch value.Operator {
			case WhereOperatorEqual:
				chain = chain.Where(field+" = ?", value.Value[0])
			case WhereOperatorNotEqual:
				chain = chain.Where(field+" != ?", value.Value[0])
			case WhereOperatorGreaterThan:
				chain = chain.Where(field+" > ?", value.Value[0])
			case WhereOperatorGreaterThanOrEqual:
				chain = chain.Where(field+" >= ?", value.Value[0])
			case WhereOperatorLessThan:
				chain = chain.Where(field+" < ?", value.Value[0])
			case WhereOperatorLessThanOrEqual:
				chain = chain.Where(field+" <= ?", value.Value[0])
			case WhereOperatorLike:
				chain = chain.Where(field+" LIKE ?", value.Value[0])
			case WhereOperatorNotLike:
				chain = chain.Where(field+" NOT LIKE ?", value.Value[0])
			case WhereOperatorIn:
				chain = chain.Where(field+" IN ?", value.Value)
			case WhereOperatorNotIn:
				chain = chain.Where(field+" NOT IN ?", value.Value)
			case WhereOperatorBetween:
				chain = chain.Where(field+" BETWEEN ? AND ?", value.Value[0], value.Value[1])
			case WhereOperatorNotBetween:
				chain = chain.Where(field+" NOT BETWEEN ? AND ?", value.Value[0], value.Value[1])
			case WhereOperatorIsNull:
				chain = chain.Where(field + " IS NULL")
			case WhereOperatorIsNotNull:
				chain = chain.Where(field + " IS NOT NULL")
			}
		}
	}

	if options.AllowPreload {
		for _, path := range f.Include {
			chain = chain.Preload(path, nil)
		}
	}

	return chain, nil
}

func (f *Options[T]) ToGormTx(tx *gorm.DB, optionsFuncs ...GormOptionsFunc) (*gorm.DB, error) {
	options := DefaultGormOptions()
	for _, optionFunc := range optionsFuncs {
		optionFunc(options)
	}

	if err := f.Validate(); err != nil {
		return nil, err
	}

	take := f.Take
	if take <= 0 {
		take = -1
	}

	chain := tx.Limit(take).Offset(f.Skip)
	if !options.AllowPaginate {
		chain = chain.Limit(-1).Offset(-1)
	}

	if options.AllowOrder {
		for field, value := range f.Order.Fields {
			chain = chain.Order(field + " " + string(value))
		}
	}

	if options.AllowWhere {
		for field, value := range f.Where.Fields {
			switch value.Operator {
			case WhereOperatorEqual:
				chain = chain.Where(field+" = ?", value.Value[0])
			case WhereOperatorNotEqual:
				chain = chain.Where(field+" != ?", value.Value[0])
			case WhereOperatorGreaterThan:
				chain = chain.Where(field+" > ?", value.Value[0])
			case WhereOperatorGreaterThanOrEqual:
				chain = chain.Where(field+" >= ?", value.Value[0])
			case WhereOperatorLessThan:
				chain = chain.Where(field+" < ?", value.Value[0])
			case WhereOperatorLessThanOrEqual:
				chain = chain.Where(field+" <= ?", value.Value[0])
			case WhereOperatorLike:
				chain = chain.Where(field+" LIKE ?", value.Value[0])
			case WhereOperatorNotLike:
				chain = chain.Where(field+" NOT LIKE ?", value.Value[0])
			case WhereOperatorIn:
				chain = chain.Where(field+" IN ?", value.Value)
			case WhereOperatorNotIn:
				chain = chain.Where(field+" NOT IN ?", value.Value)
			case WhereOperatorBetween:
				chain = chain.Where(field+" BETWEEN ? AND ?", value.Value[0], value.Value[1])
			case WhereOperatorNotBetween:
				chain = chain.Where(field+" NOT BETWEEN ? AND ?", value.Value[0], value.Value[1])
			case WhereOperatorIsNull:
				chain = chain.Where(field + " IS NULL")
			case WhereOperatorIsNotNull:
				chain = chain.Where(field + " IS NOT NULL")
			}
		}
	}

	if options.AllowPreload {
		for _, path := range f.Include {
			chain = chain.Preload(path, nil)
		}
	}

	return chain, nil
}

func DefaultGormOptions() *GormOptions {
	return &GormOptions{AllowWhere: true, AllowPreload: true, AllowPaginate: true, AllowOrder: true}
}
