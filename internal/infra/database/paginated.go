package database

type Paginated[T any] struct {
	Data  []T   `json:"data"`
	Total int64 `json:"total"`
	Skip  int64 `json:"skip"`
	Take  int64 `json:"take"`
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

func (p *Paginated[T]) HasNext() bool {
	return p.Skip+p.Take < p.Total
}

func (p *Paginated[T]) HasPrevious() bool {
	return p.Skip > 0
}

func NewPaginated[T any](data []T, total int64, skip int64, take int64) *Paginated[T] {
	return &Paginated[T]{
		Data:  data,
		Total: total,
		Skip:  skip,
		Take:  take,
	}
}
