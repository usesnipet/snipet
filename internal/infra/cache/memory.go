package cache

import (
	"container/list"
	"sync"
	"time"
)

type item struct {
	key       string
	value     any
	expiresAt int64
	element   *list.Element
}

func (i *item) expired() bool {
	return i.expiresAt > 0 && time.Now().UnixNano() > i.expiresAt
}

type MemoryCache struct {
	mu sync.RWMutex

	items map[string]*item
	lru   *list.List

	maxEntries int

	stop chan struct{}
}

func NewMemoryCache(maxEntries int, cleanupInterval time.Duration) *MemoryCache {
	c := &MemoryCache{
		items:      make(map[string]*item),
		lru:        list.New(),
		maxEntries: maxEntries,
		stop:       make(chan struct{}),
	}

	if cleanupInterval > 0 {
		go c.startJanitor(cleanupInterval)
	}

	return c
}

func (c *MemoryCache) Set(key string, value any, opts ...SetOption) error {
	var o SetOptions

	for _, fn := range opts {
		fn(&o)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if it, ok := c.items[key]; ok {
		it.value = value

		if o.TTL > 0 {
			it.expiresAt = time.Now().Add(o.TTL).UnixNano()
		} else {
			it.expiresAt = 0
		}

		c.lru.MoveToFront(it.element)
		return nil
	}

	var expires int64
	if o.TTL > 0 {
		expires = time.Now().Add(o.TTL).UnixNano()
	}

	elem := c.lru.PushFront(key)

	it := &item{
		key:       key,
		value:     value,
		expiresAt: expires,
		element:   elem,
	}

	c.items[key] = it

	c.evict()

	return nil
}

func (c *MemoryCache) Get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	it, ok := c.items[key]
	if !ok {
		return nil, false
	}

	if it.expired() {
		c.remove(it)
		return nil, false
	}

	c.lru.MoveToFront(it.element)

	return it.value, true
}

func (c *MemoryCache) Delete(key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if it, ok := c.items[key]; ok {
		c.remove(it)
	}

	return nil
}

func (c *MemoryCache) Exists(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	it, ok := c.items[key]
	if !ok {
		return false
	}

	if it.expired() {
		c.remove(it)
		return false
	}

	return true
}

func (c *MemoryCache) Clear() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*item)
	c.lru.Init()

	return nil
}

func (c *MemoryCache) Keys() []string {
	c.mu.Lock()
	defer c.mu.Unlock()

	keys := make([]string, 0, len(c.items))

	for k, it := range c.items {
		if it.expired() {
			c.remove(it)
			continue
		}

		keys = append(keys, k)
	}

	return keys
}

func (c *MemoryCache) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	return len(c.items)
}

func (c *MemoryCache) remove(it *item) {
	c.lru.Remove(it.element)
	delete(c.items, it.key)
}

func (c *MemoryCache) evict() {
	if c.maxEntries <= 0 {
		return
	}

	for len(c.items) > c.maxEntries {
		back := c.lru.Back()
		if back == nil {
			return
		}

		key := back.Value.(string)
		c.remove(c.items[key])
	}
}

func (c *MemoryCache) startJanitor(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.cleanup()

		case <-c.stop:
			return
		}
	}
}

func (c *MemoryCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, it := range c.items {
		if it.expired() {
			c.remove(it)
		}
	}
}

func (c *MemoryCache) Close() {
	close(c.stop)
}
