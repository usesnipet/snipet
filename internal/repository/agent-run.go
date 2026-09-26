package repository

import (
	"context"
	"time"

	"github.com/usesnipet/snipet/internal/model"
	"gorm.io/gorm"
)

type IAgentSessionRepository interface {
	IRepository[model.AgentSession]
}

type AgentSessionRepository struct {
	*Repository[model.AgentSession]
}

func NewAgentSessionRepository(db *gorm.DB) IAgentSessionRepository {
	return &AgentSessionRepository{Repository: NewRepository[model.AgentSession](db)}
}

type IAgentRunRepository interface {
	IRepository[model.AgentRun]
	// HasRunning reports whether a run of the session is still running.
	HasRunning(ctx context.Context, sessionID string) (bool, error)
	// FailAllRunning marks every running run, of any session, as failed with errMsg. Used at
	// boot for runs cut off by a crash.
	FailAllRunning(ctx context.Context, errMsg string) (int64, error)
}

type AgentRunRepository struct {
	*Repository[model.AgentRun]
}

func NewAgentRunRepository(db *gorm.DB) IAgentRunRepository {
	return &AgentRunRepository{Repository: NewRepository[model.AgentRun](db)}
}

func (r *AgentRunRepository) HasRunning(ctx context.Context, sessionID string) (bool, error) {
	count, err := gorm.G[model.AgentRun](r.db(ctx)).
		Where("session_id = ? AND status = ?", sessionID, model.AgentRunRunning).
		Count(ctx, "*")
	return count > 0, err
}

func (r *AgentRunRepository) FailAllRunning(ctx context.Context, errMsg string) (int64, error) {
	res := r.db(ctx).Model(&model.AgentRun{}).
		Where("status = ?", model.AgentRunRunning).
		Updates(map[string]any{
			"status":      model.AgentRunFailed,
			"error":       errMsg,
			"finished_at": time.Now(),
		})
	return res.RowsAffected, res.Error
}

type IAgentMessageRepository interface {
	IRepository[model.AgentMessage]
	// ListBySession returns every message of the session, oldest first.
	ListBySession(ctx context.Context, sessionID string) ([]model.AgentMessage, error)
	// ListByRunAfter returns the run's messages with id > afterID, oldest first.
	ListByRunAfter(ctx context.Context, runID string, afterID int64) ([]model.AgentMessage, error)
}

type AgentMessageRepository struct {
	*Repository[model.AgentMessage]
}

func NewAgentMessageRepository(db *gorm.DB) IAgentMessageRepository {
	return &AgentMessageRepository{Repository: NewRepository[model.AgentMessage](db)}
}

func (r *AgentMessageRepository) ListBySession(ctx context.Context, sessionID string) ([]model.AgentMessage, error) {
	return gorm.G[model.AgentMessage](r.db(ctx)).Where("session_id = ?", sessionID).Order("id ASC").Find(ctx)
}

func (r *AgentMessageRepository) ListByRunAfter(ctx context.Context, runID string, afterID int64) ([]model.AgentMessage, error) {
	return gorm.G[model.AgentMessage](r.db(ctx)).Where("run_id = ? AND id > ?", runID, afterID).Order("id ASC").Find(ctx)
}
