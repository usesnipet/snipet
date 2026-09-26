package agentrun

import (
	"context"
	"sync"
	"time"

	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/auth"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/logger"
	"github.com/usesnipet/snipet/internal/model"
	agentmodule "github.com/usesnipet/snipet/internal/module/agent"
	toolmodule "github.com/usesnipet/snipet/internal/module/tool"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/repository"
)

const titleLength = 80

// Service starts agent runs, one goroutine each, and serves sessions, runs
// and their messages.
type Service struct {
	rootCtx  context.Context
	tx       repository.ITxManager
	agents   *agentmodule.Service
	sessions repository.IAgentSessionRepository
	runs     repository.IAgentRunRepository
	messages repository.IAgentMessageRepository
	runner   *llm.Runner
	executor *toolmodule.Executor
	hub      *Hub
	log      *logger.Logger
	wg       sync.WaitGroup
}

// NewService builds the service. Runs live under rootCtx: cancelling it
// (server shutdown) cancels every run.
func NewService(
	rootCtx context.Context,
	tx repository.ITxManager,
	agents *agentmodule.Service,
	sessions repository.IAgentSessionRepository,
	runs repository.IAgentRunRepository,
	messages repository.IAgentMessageRepository,
	runner *llm.Runner,
	executor *toolmodule.Executor,
	log *logger.Logger,
) *Service {
	return &Service{
		rootCtx:  rootCtx,
		tx:       tx,
		agents:   agents,
		sessions: sessions,
		runs:     runs,
		messages: messages,
		runner:   runner,
		executor: executor,
		hub:      NewHub(),
		log:      log,
	}
}

// FailInterrupted marks runs left running by a previous process as failed.
func (s *Service) FailInterrupted(ctx context.Context) {
	n, err := s.runs.FailAllRunning(ctx, "interrupted")
	if err != nil {
		s.log.Errorf("failed to mark interrupted runs: %v", err)
		return
	}
	if n > 0 {
		s.log.Infof("marked %d interrupted runs as failed", n)
	}
}

// Wait blocks until every run has stopped, or timeout.
func (s *Service) Wait(timeout time.Duration) {
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(timeout):
		s.log.Errorf("timed out waiting for agent runs to stop")
	}
}

// Start saves the user message and launches the run in its own goroutine,
// returning without waiting for it.
func (s *Service) Start(ctx context.Context, dto StartRunDTO) (*model.AgentRun, error) {
	c, err := currentCaller(ctx)
	if err != nil {
		return nil, err
	}

	agent, err := s.agents.FindByID(ctx, dto.AgentID)
	if err != nil {
		return nil, err
	}
	if !agent.Enabled {
		return nil, apperr.BadRequest("agent is disabled")
	}
	targets, err := s.agents.Targets(ctx, agent)
	if err != nil {
		return nil, err
	}
	tools, index, err := s.agents.ResolveTools(ctx, agent)
	if err != nil {
		return nil, err
	}

	var session *model.AgentSession
	if dto.SessionID != nil {
		if session, err = s.findSession(ctx, c, *dto.SessionID); err != nil {
			return nil, err
		}
		if session.AgentID != agent.ID {
			return nil, apperr.BadRequest("session belongs to another agent")
		}
		running, err := s.runs.HasRunning(ctx, session.ID)
		if err != nil {
			return nil, err
		}
		if running {
			return nil, apperr.Conflict("a run is already running in this session")
		}
	} else {
		if session, err = c.newSession(agent.ID, dto.Subject, dto.Input); err != nil {
			return nil, err
		}
	}

	run := &model.AgentRun{Status: model.AgentRunRunning}
	err = s.tx.WithTransaction(ctx, func(ctx context.Context) error {
		if session.ID == "" {
			if err := s.sessions.Create(ctx, session); err != nil {
				return err
			}
		} else if err := s.sessions.UpdateByID(ctx, session.ID, &model.AgentSession{UpdatedAt: time.Now()}); err != nil {
			return err
		}
		run.SessionID = session.ID
		if err := s.runs.Create(ctx, run); err != nil {
			return err
		}
		return s.messages.Create(ctx, &model.AgentMessage{
			SessionID: session.ID,
			RunID:     run.ID,
			Role:      llm.RoleUser,
			Parts:     model.MessageParts{llm.TextPart{Text: dto.Input}},
		})
	})
	if err != nil {
		return nil, err
	}

	runCtx, cancel := context.WithCancel(s.rootCtx)
	s.hub.register(run.ID, cancel)
	s.wg.Go(func() {
		defer cancel()
		s.execute(runCtx, run, agent, targets, tools, index)
	})
	return run, nil
}

func (s *Service) FindRun(ctx context.Context, id string) (*model.AgentRun, error) {
	c, err := currentCaller(ctx)
	if err != nil {
		return nil, err
	}
	return s.findRun(ctx, c, id)
}

func (s *Service) FilterRuns(ctx context.Context, dto FindRunsFilterDTO) (*page.Paginated[model.AgentRun], error) {
	c, err := currentCaller(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := s.findSession(ctx, c, dto.SessionID); err != nil {
		return nil, err
	}
	return s.runs.Filter(ctx, dto.ToFilter())
}

// Cancel stops a live run. Cancelling a finished run is a no-op.
func (s *Service) Cancel(ctx context.Context, id string) error {
	c, err := currentCaller(ctx)
	if err != nil {
		return err
	}
	if _, err := s.findRun(ctx, c, id); err != nil {
		return err
	}
	s.hub.cancel(id)
	return nil
}

func (s *Service) FilterSessions(ctx context.Context, dto FindSessionsFilterDTO) (*page.Paginated[model.AgentSession], error) {
	c, err := currentCaller(ctx)
	if err != nil {
		return nil, err
	}
	var userID *string
	if !c.seesAll() {
		userID = &c.userID
	}
	return s.sessions.Filter(ctx, dto.ToFilter(userID))
}

func (s *Service) FindSession(ctx context.Context, id string) (*model.AgentSession, error) {
	c, err := currentCaller(ctx)
	if err != nil {
		return nil, err
	}
	return s.findSession(ctx, c, id)
}

// DeleteSession removes a session with its runs and messages. A session with
// a running run can't be deleted; cancel the run first.
func (s *Service) DeleteSession(ctx context.Context, id string) error {
	c, err := currentCaller(ctx)
	if err != nil {
		return err
	}
	if _, err := s.findSession(ctx, c, id); err != nil {
		return err
	}
	running, err := s.runs.HasRunning(ctx, id)
	if err != nil {
		return err
	}
	if running {
		return apperr.Conflict("a run is still running in this session")
	}
	return s.sessions.DeleteByID(ctx, id)
}

func (s *Service) FilterMessages(ctx context.Context, sessionID string, dto FindMessagesFilterDTO) (*page.Paginated[model.AgentMessage], error) {
	c, err := currentCaller(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := s.findSession(ctx, c, sessionID); err != nil {
		return nil, err
	}
	return s.messages.Filter(ctx, dto.ToFilter(sessionID))
}

// Events writes the run's events to write: stored messages after lastID,
// then live events until the run finishes or ctx ends.
func (s *Service) Events(ctx context.Context, runID string, lastID int64, write func(Event) error) error {
	c, err := currentCaller(ctx)
	if err != nil {
		return err
	}
	if _, err := s.findRun(ctx, c, runID); err != nil {
		return err
	}

	// Subscribe before reading the DB so no message falls between the two.
	events, unsubscribe, live := s.hub.subscribe(runID)
	defer unsubscribe()

	if lastID, err = s.replay(ctx, runID, lastID, write); err != nil {
		return err
	}
	if !live {
		return s.writeFinished(ctx, runID, write)
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case ev, ok := <-events:
			if !ok {
				// Run ended; events dropped for a slow subscriber are in the DB.
				if _, err := s.replay(ctx, runID, lastID, write); err != nil {
					return err
				}
				return s.writeFinished(ctx, runID, write)
			}
			if ev.Type == EventMessage {
				if ev.ID <= lastID {
					continue
				}
				lastID = ev.ID
			}
			if err := write(ev); err != nil {
				return err
			}
			if ev.Type == EventRunFinished {
				return nil
			}
		}
	}
}

func (s *Service) replay(ctx context.Context, runID string, afterID int64, write func(Event) error) (int64, error) {
	stored, err := s.messages.ListByRunAfter(ctx, runID, afterID)
	if err != nil {
		return afterID, err
	}
	for _, m := range stored {
		if err := write(Event{ID: m.ID, Type: EventMessage, Data: m}); err != nil {
			return afterID, err
		}
		afterID = m.ID
	}
	return afterID, nil
}

func (s *Service) writeFinished(ctx context.Context, runID string, write func(Event) error) error {
	run, err := s.runs.FindByID(ctx, runID)
	if err != nil {
		return err
	}
	return write(Event{Type: EventRunFinished, Data: run})
}

func (s *Service) findSession(ctx context.Context, c caller, id string) (*model.AgentSession, error) {
	session, err := s.sessions.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !c.canSee(session) {
		return nil, apperr.NotFound("entity not found")
	}
	return session, nil
}

func (s *Service) findRun(ctx context.Context, c caller, id string) (*model.AgentRun, error) {
	run, err := s.runs.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if _, err := s.findSession(ctx, c, run.SessionID); err != nil {
		return nil, err
	}
	return run, nil
}

// caller is who is making the request: a snipet user or an API key.
type caller struct {
	userID string
	admin  bool
	apiKey bool
}

func currentCaller(ctx context.Context) (caller, error) {
	if user, err := auth.CurrentUser(ctx); err == nil {
		return caller{userID: user.ID, admin: user.IsAdmin()}, nil
	}
	if auth.HasApiKey(ctx) {
		return caller{apiKey: true}, nil
	}
	return caller{}, apperr.Unauthorized("unauthorized")
}

// seesAll is true for admins and API keys; users only see their own sessions.
func (c caller) seesAll() bool {
	return c.admin || c.apiKey
}

func (c caller) canSee(session *model.AgentSession) bool {
	return c.seesAll() || (session.UserID != nil && *session.UserID == c.userID)
}

// newSession builds (without saving) a session owned by the caller.
func (c caller) newSession(agentID string, subject *string, input string) (*model.AgentSession, error) {
	session := &model.AgentSession{AgentID: agentID, Title: title(input)}
	if c.apiKey {
		if subject == nil {
			return nil, apperr.BadRequest("subject is required when starting a session with an API key")
		}
		session.Subject = subject
		return session, nil
	}
	session.UserID = &c.userID
	return session, nil
}

func title(input string) string {
	runes := []rune(input)
	if len(runes) > titleLength {
		runes = runes[:titleLength]
	}
	return string(runes)
}
