package queue_test

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/queue"
)

func TestPoolRunsJobs(t *testing.T) {
	t.Parallel()

	pool := queue.NewPool(2, nil)
	pool.Start(context.Background())
	t.Cleanup(pool.Stop)

	var done atomic.Int32
	for range 5 {
		err := pool.Submit(context.Background(), func(ctx context.Context) error {
			done.Add(1)
			return nil
		})
		require.NoError(t, err)
	}

	require.Eventually(t, func() bool {
		return done.Load() == 5
	}, time.Second, 10*time.Millisecond)
}

func TestPoolSubmitAfterStop(t *testing.T) {
	t.Parallel()

	pool := queue.NewPool(1, nil)
	pool.Start(context.Background())
	pool.Stop()

	err := pool.Submit(context.Background(), func(ctx context.Context) error {
		return nil
	})
	assert.ErrorIs(t, err, queue.ErrPoolStopped)
}

func TestNewPoolClampsWorkers(t *testing.T) {
	t.Parallel()

	pool := queue.NewPool(0, nil)
	pool.Start(context.Background())
	t.Cleanup(pool.Stop)

	var done atomic.Int32
	require.NoError(t, pool.Submit(context.Background(), func(ctx context.Context) error {
		done.Add(1)
		return nil
	}))
	require.Eventually(t, func() bool {
		return done.Load() == 1
	}, time.Second, 10*time.Millisecond)
}
