package agentrun

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/tool"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// execute runs the agent loop for one run: call the LLMs, run the tools they
// ask for, repeat until the LLM answers without tool calls or max turns.
func (s *Service) execute(ctx context.Context, run *model.AgentRun, agent *model.Agent, targets []llm.Target, tools []llm.Tool, index map[string]string) {
	defer s.hub.finish(run.ID)

	status, runErr := s.loop(ctx, run, agent, targets, tools, index)
	if status == model.AgentRunFailed && ctx.Err() != nil {
		status, runErr = model.AgentRunCancelled, nil
		if s.rootCtx.Err() != nil {
			runErr = errors.New("server shutdown")
		}
	}

	// The run's ctx may be cancelled; the final state must still be saved.
	saveCtx := context.WithoutCancel(ctx)
	now := time.Now()
	run.Status = status
	run.FinishedAt = &now
	if runErr != nil {
		run.Error = runErr.Error()
	}
	if err := s.runs.UpdateByID(saveCtx, run.ID, run); err != nil {
		s.log.Errorf("agent run %s: failed to save final state: %v", run.ID, err)
	}
	s.hub.publish(run.ID, Event{Type: EventRunFinished, Data: run})
}

func (s *Service) loop(ctx context.Context, run *model.AgentRun, agent *model.Agent, targets []llm.Target, tools []llm.Tool, index map[string]string) (model.AgentRunStatus, error) {
	history, err := s.messages.ListBySession(ctx, run.SessionID)
	if err != nil {
		return model.AgentRunFailed, err
	}
	var msgs []llm.Message
	if agent.SystemPrompt != "" {
		msgs = append(msgs, llm.Text(llm.RoleSystem, agent.SystemPrompt))
	}
	msgs = append(msgs, validHistory(history)...)

	s.hub.publish(run.ID, Event{Type: EventRunStarted, Data: run})
	for turn := 1; turn <= agent.MaxTurns; turn++ {
		run.Turns = turn
		s.hub.publish(run.ID, Event{Type: EventTurnStarted, Data: TurnStartedData{Turn: turn}})

		reply, llmName, err := s.stream(ctx, run.ID, targets, msgs, tools)
		if err != nil {
			return model.AgentRunFailed, err
		}
		assistant := &model.AgentMessage{
			SessionID: run.SessionID,
			RunID:     run.ID,
			Role:      llm.RoleAssistant,
			Parts:     reply.Parts,
			Model:     &llmName,
		}
		if err := s.save(ctx, run.ID, assistant); err != nil {
			return model.AgentRunFailed, err
		}
		msgs = append(msgs, reply)

		calls := toolCalls(reply)
		if len(calls) == 0 {
			return model.AgentRunCompleted, nil
		}
		for _, call := range calls {
			result, err := s.callTool(ctx, run, call, index)
			if err != nil {
				return model.AgentRunFailed, err
			}
			msgs = append(msgs, result.Message())
		}
	}
	return model.AgentRunMaxTurns, nil
}

// stream runs one LLM call, forwarding its live events, and returns the
// assembled reply and the "provider/model" that produced it.
func (s *Service) stream(ctx context.Context, runID string, targets []llm.Target, msgs []llm.Message, tools []llm.Tool) (llm.Message, string, error) {
	it, err := s.runner.Stream(ctx, targets, msgs, tools)
	if err != nil {
		return llm.Message{}, "", err
	}
	defer it.Close()

	var reply llm.Message
	var llmName string
	for it.Next(ctx) {
		switch e := it.Event().(type) {
		case llm.LLMStartEvent:
			llmName = e.LLM
			s.hub.publish(runID, Event{Type: EventLLMStarted, Data: e})
		case llm.LLMSkippedEvent:
			s.log.Infof("agent run %s: skipped %s: %s", runID, e.LLM, e.Error)
			s.hub.publish(runID, Event{Type: EventLLMSkipped, Data: e})
		case llm.TextDeltaEvent:
			s.hub.publish(runID, Event{Type: EventTextDelta, Data: e})
		case llm.MessageEvent:
			reply = e.Message
		}
	}
	if err := it.Err(); err != nil {
		return llm.Message{}, "", err
	}
	return reply, llmName, nil
}

// callTool runs one tool call and saves its result. Tool failures become an
// is_error result for the LLM; only a failed save stops the run.
func (s *Service) callTool(ctx context.Context, run *model.AgentRun, call llm.ToolCallPart, index map[string]string) (*model.AgentMessage, error) {
	var toolID *string
	if id, ok := index[call.Name]; ok {
		toolID = &id
	}
	s.hub.publish(run.ID, Event{Type: EventToolCallStarted, Data: ToolCallStartedData{CallID: call.ID, Name: call.Name, ToolID: toolID}})

	start := time.Now()
	res := s.runTool(ctx, toolID, call)
	duration := time.Since(start).Milliseconds()

	msg := &model.AgentMessage{
		SessionID:  run.SessionID,
		RunID:      run.ID,
		Role:       llm.RoleTool,
		Parts:      model.MessageParts{llm.ToolResultPart{ToolCallID: call.ID, Content: res.Content, IsError: res.IsError}},
		ToolID:     toolID,
		DurationMs: &duration,
	}
	return msg, s.save(ctx, run.ID, msg)
}

func (s *Service) runTool(ctx context.Context, toolID *string, call llm.ToolCallPart) *tool.Result {
	if toolID == nil {
		return &tool.Result{Content: "unknown tool " + call.Name, IsError: true}
	}
	args := jsonx.JSONMap{}
	if len(call.Arguments) > 0 {
		if err := json.Unmarshal(call.Arguments, &args); err != nil {
			return &tool.Result{Content: "invalid arguments: " + err.Error(), IsError: true}
		}
	}
	res, err := s.executor.Execute(ctx, *toolID, args)
	if err != nil {
		return &tool.Result{Content: err.Error(), IsError: true}
	}
	return res
}

// save stores a message and publishes it with its id.
func (s *Service) save(ctx context.Context, runID string, msg *model.AgentMessage) error {
	if err := s.messages.Create(context.WithoutCancel(ctx), msg); err != nil {
		return err
	}
	s.hub.publish(runID, Event{ID: msg.ID, Type: EventMessage, Data: msg})
	return nil
}

func toolCalls(m llm.Message) []llm.ToolCallPart {
	var calls []llm.ToolCallPart
	for _, p := range m.Parts {
		if c, ok := p.(llm.ToolCallPart); ok {
			calls = append(calls, c)
		}
	}
	return calls
}

// validHistory turns stored messages into the conversation sent to the LLM,
// dropping an assistant message whose tool calls never all got a result
// (a cancelled or failed run) along with its partial results — providers
// reject unanswered tool calls.
func validHistory(rows []model.AgentMessage) []llm.Message {
	answered := make(map[string]bool)
	for _, r := range rows {
		for _, p := range r.Parts {
			if res, ok := p.(llm.ToolResultPart); ok {
				answered[res.ToolCallID] = true
			}
		}
	}

	dropped := make(map[string]bool)
	out := make([]llm.Message, 0, len(rows))
	for _, r := range rows {
		m := r.Message()
		switch m.Role {
		case llm.RoleAssistant:
			calls := toolCalls(m)
			complete := true
			for _, c := range calls {
				complete = complete && answered[c.ID]
			}
			if !complete {
				for _, c := range calls {
					dropped[c.ID] = true
				}
				continue
			}
		case llm.RoleTool:
			if isDropped(m, dropped) {
				continue
			}
		}
		out = append(out, m)
	}
	return out
}

func isDropped(m llm.Message, dropped map[string]bool) bool {
	for _, p := range m.Parts {
		if res, ok := p.(llm.ToolResultPart); ok && dropped[res.ToolCallID] {
			return true
		}
	}
	return false
}
