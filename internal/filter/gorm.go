package filter

import (
	"gorm.io/gorm"
)

func (f *Options[T]) ToGorm(gormInterface gorm.Interface[T]) (gorm.ChainInterface[T], error) {
	if err := f.Validate(); err != nil {
		return nil, err
	}

	chain := gormInterface.Limit(f.Take).Offset(f.Skip)
	for field, value := range f.Order.Fields {
		chain = chain.Order(field + " " + string(value))
	}
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

	return chain, nil
}
