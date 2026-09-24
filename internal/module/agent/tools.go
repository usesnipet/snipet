package agent

import (
	"path"
	"strings"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
)

// maxToolNameLength is the tool name limit most providers enforce.
const maxToolNameLength = 64

// allowedTools filters tools by the agent's server grants and names each one
// "<server>__<tool>" so tools from different servers never collide. tools
// must have McpServer loaded.
func allowedTools(grants []model.AgentMcpServer, tools []model.Tool) ([]llm.Tool, map[string]string) {
	byServer := make(map[string]model.AgentMcpServer, len(grants))
	for _, g := range grants {
		byServer[g.McpServerID] = g
	}

	var out []llm.Tool
	index := make(map[string]string)
	for _, t := range tools {
		if t.McpServerId == nil || t.McpServer == nil {
			continue
		}
		grant, ok := byServer[*t.McpServerId]
		if !ok || !isAllowed(grant, t.Name) {
			continue
		}
		name := llmToolName(t.McpServer.Name, t.Name)
		// ponytail: a name collision after sanitizing drops the later tool; add a hash suffix if it ever happens
		if _, taken := index[name]; taken {
			continue
		}
		index[name] = t.ID
		out = append(out, llm.Tool{Name: name, Description: t.Description, Parameters: t.InputSchema})
	}
	return out, index
}

// isAllowed applies a grant's patterns: an empty allow list allows every
// tool, and deny wins over allow.
func isAllowed(grant model.AgentMcpServer, name string) bool {
	if matchAny(grant.Deny, name) {
		return false
	}
	return len(grant.Allow) == 0 || matchAny(grant.Allow, name)
}

func matchAny(patterns []string, name string) bool {
	for _, p := range patterns {
		if ok, _ := path.Match(p, name); ok {
			return true
		}
	}
	return false
}

// llmToolName builds "<server>__<tool>" restricted to [a-zA-Z0-9_-] and cut
// to maxToolNameLength.
func llmToolName(server, tool string) string {
	name := sanitize(server) + "__" + sanitize(tool)
	if len(name) > maxToolNameLength {
		name = name[:maxToolNameLength]
	}
	return name
}

func sanitize(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '_', r == '-':
			return r
		default:
			return '_'
		}
	}, s)
}
