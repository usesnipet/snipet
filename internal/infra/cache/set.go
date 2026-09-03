package cache

import "time"

type SetOptions struct {
	TTL time.Duration
}

type SetOption func(*SetOptions)

func WithTTL(ttl time.Duration) SetOption {
	return func(o *SetOptions) {
		o.TTL = ttl
	}
}
