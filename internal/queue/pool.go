package queue

import (
	"context"
	"errors"
	"sync"

	"github.com/usesnipet/snipet/internal/logger"
)

var (
	ErrPoolStopped = errors.New("worker pool is stopped")
)

// Job is a unit of work executed by a pool worker.
type Job func(ctx context.Context) error

// IPool is an in-process worker pool for background jobs.
type IPool interface {
	Submit(ctx context.Context, job Job) error
}

// Pool is a fixed-size worker pool backed by an in-memory job queue.
type Pool struct {
	workers int
	jobs    chan Job
	logger  *logger.Logger

	quit   chan struct{}
	cancel context.CancelFunc
	wg     sync.WaitGroup
	once   sync.Once
}

func NewPool(workers int, logger *logger.Logger) *Pool {
	if workers < 1 {
		workers = 1
	}
	return &Pool{
		workers: workers,
		jobs:    make(chan Job, workers*8),
		logger:  logger,
		quit:    make(chan struct{}),
	}
}

// Start launches the worker goroutines. Jobs run against a context derived from parent.
func (p *Pool) Start(parent context.Context) {
	ctx, cancel := context.WithCancel(parent)
	p.cancel = cancel
	for range p.workers {
		p.wg.Add(1)
		go p.loop(ctx)
	}
}

func (p *Pool) loop(ctx context.Context) {
	defer p.wg.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <-p.jobs:
			if !ok {
				return
			}
			if err := job(ctx); err != nil && p.logger != nil {
				p.logger.Errorf("background job failed: %v", err)
			}
		}
	}
}

// Submit enqueues a job. Blocks until the job is accepted, ctx is cancelled, or the pool stops.
func (p *Pool) Submit(ctx context.Context, job Job) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-p.quit:
		return ErrPoolStopped
	default:
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-p.quit:
		return ErrPoolStopped
	case p.jobs <- job:
		return nil
	}
}

// Stop cancels in-flight work and waits for workers to exit.
func (p *Pool) Stop() {
	p.once.Do(func() {
		close(p.quit)
		if p.cancel != nil {
			p.cancel()
		}
		p.wg.Wait()
	})
}
