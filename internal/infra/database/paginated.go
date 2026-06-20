package database

type Paginated[T any] struct {
	Data  []T   `json:"data"`
	Total int64 `json:"total"`
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
}

func (p *Paginated[T]) IsEmpty() bool {
	return len(p.Data) == 0
}

func (p *Paginated[T]) IsNotEmpty() bool {
	return len(p.Data) > 0
}

func (p *Paginated[T]) First() *T {
	return &p.Data[0]
}

func (p *Paginated[T]) Last() *T {
	return &p.Data[len(p.Data)-1]
}

func (p *Paginated[T]) Count() int {
	return len(p.Data)
}

func NewPaginated[T any](data []T, total int64, page int, limit int) *Paginated[T] {
	return &Paginated[T]{
		Data:  data,
		Total: total,
		Page:  page,
		Limit: limit,
	}
}
