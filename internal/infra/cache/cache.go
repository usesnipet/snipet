package cache

type ICache interface {
	Set(key string, value any, opts ...SetOption) error

	Get(key string) (any, bool)

	Delete(key string) error

	Exists(key string) bool

	Clear() error

	Keys() []string

	Len() int
}

func GetAs[T any](c ICache, key string) (T, bool) {
	var zero T
	v, ok := c.Get(key)
	if !ok {
		return zero, false
	}
	typed, ok := v.(T)
	return typed, ok
}
