package agent

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/usesnipet/snipet/internal/model"
)

func TestAllowedTools(t *testing.T) {
	t.Parallel()

	github := &model.McpServer{ID: "gh", Name: "git hub"}
	slack := &model.McpServer{ID: "sl", Name: "slack"}
	tool := func(id string, server *model.McpServer, name string) model.Tool {
		return model.Tool{ID: id, Name: name, McpServerId: &server.ID, McpServer: server}
	}
	tools := []model.Tool{
		tool("1", github, "list_repos"),
		tool("2", github, "delete_repo"),
		tool("3", github, "list_issues"),
		tool("4", slack, "send.message"),
		tool("5", &model.McpServer{ID: "other", Name: "other"}, "list_x"),
	}

	cases := []struct {
		name   string
		grants []model.AgentMcpServer
		want   map[string]string
	}{
		{
			name:   "empty allow grants every tool of the server",
			grants: []model.AgentMcpServer{{McpServerID: "sl"}},
			want:   map[string]string{"slack__send_message": "4"},
		},
		{
			name:   "allow narrows",
			grants: []model.AgentMcpServer{{McpServerID: "gh", Allow: []string{"list_*"}}},
			want:   map[string]string{"git_hub__list_repos": "1", "git_hub__list_issues": "3"},
		},
		{
			name:   "deny wins over allow",
			grants: []model.AgentMcpServer{{McpServerID: "gh", Allow: []string{"*"}, Deny: []string{"*delete*", "list_issues"}}},
			want:   map[string]string{"git_hub__list_repos": "1"},
		},
		{
			name: "no grant, no tools",
			want: map[string]string{},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			out, index := allowedTools(tc.grants, tools)
			assert.Equal(t, tc.want, index)
			assert.Len(t, out, len(tc.want))
		})
	}
}

func TestLLMToolNameIsCutTo64(t *testing.T) {
	t.Parallel()

	name := llmToolName("server", strings.Repeat("a", 100))
	assert.Len(t, name, maxToolNameLength)
	assert.True(t, strings.HasPrefix(name, "server__a"))
}
