package database

type Paginated[T any] struct {
	Data  []T   `json:"data"`
	Total int64 `json:"total"`
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
}

func NewPaginated[T any](data []T, total int64, page int, limit int) *Paginated[T] {
	return &Paginated[T]{
		Data:  data,
		Total: total,
		Page:  page,
		Limit: limit,
	}
}
