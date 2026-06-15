package filter

import (
	"gorm.io/gorm"
)

func (f *Options[T]) ToGorm(gormInterface gorm.Interface[T]) gorm.ChainInterface[T] {
	chain := gormInterface.Limit(f.Take).Offset(f.Skip)
	for field, value := range f.Order.Fields {
		chain = chain.Order(field + " " + string(value))
	}
	for field, value := range f.Where.Fields {
		switch value.Operator {
		case WhereOperatorEqual:
			chain = chain.Where("? = ?", field, value.Value[0])
		case WhereOperatorNotEqual:
			chain = chain.Where("? != ?", field, value.Value[0])
		case WhereOperatorGreaterThan:
			chain = chain.Where("? > ?", field, value.Value[0])
		case WhereOperatorGreaterThanOrEqual:
			chain = chain.Where("? >= ?", field, value.Value[0])
		case WhereOperatorLessThan:
			chain = chain.Where("? < ?", field, value.Value[0])
		case WhereOperatorLessThanOrEqual:
			chain = chain.Where("? <= ?", field, value.Value[0])
		case WhereOperatorLike:
			chain = chain.Where("? LIKE ?", field, value.Value[0])
		case WhereOperatorNotLike:
			chain = chain.Where("? NOT LIKE ?", field, value.Value[0])
		case WhereOperatorIn:
			chain = chain.Where("? IN ?", field, value.Value)
		case WhereOperatorNotIn:
			chain = chain.Where("? NOT IN ?", field, value.Value)
		case WhereOperatorBetween:
			chain = chain.Where("? BETWEEN ? AND ?", field, value.Value[0], value.Value[1])
		case WhereOperatorNotBetween:
			chain = chain.Where("? NOT BETWEEN ? AND ?", field, value.Value[0], value.Value[1])
		case WhereOperatorIsNull:
			chain = chain.Where("? IS NULL", field)
		case WhereOperatorIsNotNull:
			chain = chain.Where("? IS NOT NULL", field)
		}
	}
	return chain
}
