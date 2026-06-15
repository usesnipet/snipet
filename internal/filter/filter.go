package filter

type OrderDirection string

func ParseOrderDirection(value string) OrderDirection {
	switch value {
	case "asc", "ASC":
		return OrderDirectionAsc
	case "desc", "DESC":
		return OrderDirectionDesc
	}
	return OrderDirectionAsc
}

const (
	OrderDirectionAsc  OrderDirection = "ASC"
	OrderDirectionDesc OrderDirection = "DESC"
)

type OrderOptions struct {
	Fields map[string]OrderDirection
}

type WhereOperator string

const (
	WhereOperatorEqual              WhereOperator = "eq"
	WhereOperatorNotEqual           WhereOperator = "neq"
	WhereOperatorGreaterThan        WhereOperator = "gt"
	WhereOperatorGreaterThanOrEqual WhereOperator = "gte"
	WhereOperatorLessThan           WhereOperator = "lt"
	WhereOperatorLessThanOrEqual    WhereOperator = "lte"
	WhereOperatorLike               WhereOperator = "like"
	WhereOperatorNotLike            WhereOperator = "not like"
	WhereOperatorIn                 WhereOperator = "in"
	WhereOperatorNotIn              WhereOperator = "not in"
	WhereOperatorBetween            WhereOperator = "between"
	WhereOperatorNotBetween         WhereOperator = "not between"
	WhereOperatorIsNull             WhereOperator = "is null"
	WhereOperatorIsNotNull          WhereOperator = "is not null"
)

func ParseWhereOperator(value string) WhereOperator {
	switch value {
	case "eq":
		return WhereOperatorEqual
	case "neq":
		return WhereOperatorNotEqual
	case "gt":
		return WhereOperatorGreaterThan
	case "gte":
		return WhereOperatorGreaterThanOrEqual
	case "lt":
		return WhereOperatorLessThan
	case "lte":
		return WhereOperatorLessThanOrEqual
	case "like":
		return WhereOperatorLike
	case "not like":
		return WhereOperatorNotLike
	case "in":
		return WhereOperatorIn
	case "not in":
		return WhereOperatorNotIn
	case "between":
		return WhereOperatorBetween
	case "not between":
		return WhereOperatorNotBetween
	case "is null":
		return WhereOperatorIsNull
	case "is not null":
		return WhereOperatorIsNotNull
	}
	return WhereOperatorEqual
}

type WhereFieldOptions struct {
	Operator WhereOperator
	Value    []any
}

type WhereOptions struct {
	Fields map[string]WhereFieldOptions
}

type Options[T any] struct {
	Take  int
	Skip  int
	Order OrderOptions
	Where WhereOptions
}
