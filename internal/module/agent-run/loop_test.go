package agentrun

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
)

func row(role llm.Role, parts ...llm.Part) model.AgentMessage {
	return model.AgentMessage{Role: role, Parts: parts}
}

func TestValidHistoryDropsUnansweredToolCalls(t *testing.T) {
	t.Parallel()

	rows := []model.AgentMessage{
		row(llm.RoleUser, llm.TextPart{Text: "hi"}),
		row(llm.RoleAssistant, llm.ToolCallPart{ID: "a"}),
		row(llm.RoleTool, llm.ToolResultPart{ToolCallID: "a"}),
		row(llm.RoleAssistant, llm.TextPart{Text: "done"}),
		row(llm.RoleUser, llm.TextPart{Text: "again"}),
		// cancelled mid-turn: call c never got a result
		row(llm.RoleAssistant, llm.ToolCallPart{ID: "b"}, llm.ToolCallPart{ID: "c"}),
		row(llm.RoleTool, llm.ToolResultPart{ToolCallID: "b"}),
		row(llm.RoleUser, llm.TextPart{Text: "retry"}),
	}

	got := validHistory(rows)

	roles := make([]llm.Role, 0, len(got))
	for _, m := range got {
		roles = append(roles, m.Role)
	}
	assert.Equal(t, []llm.Role{llm.RoleUser, llm.RoleAssistant, llm.RoleTool, llm.RoleAssistant, llm.RoleUser, llm.RoleUser}, roles)
}

func TestMessagePartsRoundTrip(t *testing.T) {
	t.Parallel()

	parts := model.MessageParts{
		llm.TextPart{Text: "x"},
		llm.ToolCallPart{ID: "1", Name: "srv__t", Arguments: json.RawMessage(`{"a":1}`)},
		llm.ToolResultPart{ToolCallID: "1", Content: "ok", IsError: true},
	}
	value, err := parts.Value()
	require.NoError(t, err)

	var back model.MessageParts
	require.NoError(t, back.Scan(value))
	assert.Equal(t, parts, back)
}

func TestCallerVisibility(t *testing.T) {
	t.Parallel()

	owner := "u1"
	own := &model.AgentSession{UserID: &owner}
	subject := "ext-1"
	external := &model.AgentSession{Subject: &subject}

	assert.True(t, caller{userID: "u1"}.canSee(own))
	assert.False(t, caller{userID: "u2"}.canSee(own))
	assert.False(t, caller{userID: "u1"}.canSee(external))
	assert.True(t, caller{admin: true}.canSee(external))
	assert.True(t, caller{apiKey: true}.canSee(own))

	_, err := caller{apiKey: true}.newSession("a", nil, "hi")
	assert.Error(t, err, "API key needs a subject")
	s, err := caller{userID: "u1"}.newSession("a", &subject, "hi")
	require.NoError(t, err)
	assert.Nil(t, s.Subject)
	assert.Equal(t, &owner, s.UserID)
}
