package mcpserver

import (
	"context"
	"sync"
	"time"

	"github.com/usesnipet/snipet/internal/logger"
	"github.com/usesnipet/snipet/internal/queue"
	"github.com/usesnipet/snipet/internal/repository"
)

const enqueueTimeout = 5 * time.Second

// SyncWorker runs SyncService in the background: every server on each tick,
// and single servers on demand through Enqueue.
type SyncWorker struct {
	sync     *SyncService
	servers  repository.IMcpServerRepository
	pool     queue.IPool
	interval time.Duration
	log      *logger.Logger

	// pending holds the ids queued or syncing, so a server is never synced twice at once.
	pending sync.Map
}

func NewSyncWorker(
	syncService *SyncService,
	servers repository.IMcpServerRepository,
	pool queue.IPool,
	interval time.Duration,
	log *logger.Logger,
) *SyncWorker {
	return &SyncWorker{sync: syncService, servers: servers, pool: pool, interval: interval, log: log}
}

// Start syncs every server right away and then on every interval, until ctx is done.
func (w *SyncWorker) Start(ctx context.Context) {
	go func() {
		w.enqueueAll(ctx)
		if w.interval <= 0 {
			return
		}
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				w.enqueueAll(ctx)
			}
		}
	}()
}

// Enqueue schedules a sync of one server without blocking the caller.
func (w *SyncWorker) Enqueue(id string) {
	if _, queued := w.pending.LoadOrStore(id, struct{}{}); queued {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), enqueueTimeout)
		defer cancel()
		err := w.pool.Submit(ctx, func(ctx context.Context) error {
			defer w.pending.Delete(id)
			return w.sync.SyncServer(ctx, id)
		})
		if err != nil {
			w.pending.Delete(id)
			w.log.Warnf("could not enqueue sync of mcp server %s: %v", id, err)
		}
	}()
}

func (w *SyncWorker) enqueueAll(ctx context.Context) {
	servers, err := w.servers.Filter(ctx, nil)
	if err != nil {
		w.log.Errorf("list mcp servers to sync: %v", err)
		return
	}
	for _, server := range servers.Data {
		w.Enqueue(server.ID)
	}
}
