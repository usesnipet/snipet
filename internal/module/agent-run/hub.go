package agentrun

import (
	"context"
	"sync"
)

// subscriberBuffer is how many events a slow subscriber may lag behind
// before it starts missing live events (it catches up from the DB).
const subscriberBuffer = 256

// Event is one live event of a run. ID is set only on message events.
type Event struct {
	ID   int64
	Type string
	Data any
}

type liveRun struct {
	cancel context.CancelFunc
	subs   map[chan Event]struct{}
}

// Hub tracks the runs executing in this process: their cancel func and the
// SSE subscribers following them.
// ponytail: in-memory, so only the instance running a run can stream or
// cancel it; move to Postgres LISTEN/NOTIFY when running several instances.
type Hub struct {
	mu   sync.Mutex
	runs map[string]*liveRun
}

func NewHub() *Hub {
	return &Hub{runs: make(map[string]*liveRun)}
}

func (h *Hub) register(runID string, cancel context.CancelFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.runs[runID] = &liveRun{cancel: cancel, subs: make(map[chan Event]struct{})}
}

// publish never blocks: a subscriber whose buffer is full misses the event.
func (h *Hub) publish(runID string, ev Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	run, ok := h.runs[runID]
	if !ok {
		return
	}
	for ch := range run.subs {
		select {
		case ch <- ev:
		default:
		}
	}
}

// subscribe returns a channel of the run's live events, closed when the run
// ends. ok is false when the run is not executing in this process.
func (h *Hub) subscribe(runID string) (events <-chan Event, unsubscribe func(), ok bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	run, ok := h.runs[runID]
	if !ok {
		return nil, func() {}, false
	}
	ch := make(chan Event, subscriberBuffer)
	run.subs[ch] = struct{}{}
	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if _, still := run.subs[ch]; still {
			delete(run.subs, ch)
			close(ch)
		}
	}, true
}

// cancel stops a live run; false when it is not executing in this process.
func (h *Hub) cancel(runID string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	run, ok := h.runs[runID]
	if ok {
		run.cancel()
	}
	return ok
}

// finish closes every subscriber of the run and forgets it.
func (h *Hub) finish(runID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	run, ok := h.runs[runID]
	if !ok {
		return
	}
	for ch := range run.subs {
		close(ch)
		delete(run.subs, ch)
	}
	delete(h.runs, runID)
}
