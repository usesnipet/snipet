package llm

import (
	"encoding/json"
	"fmt"
)

// Role identifies who authored a Message.
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// Message is one turn in a conversation: a role plus an ordered list of
// content parts. A plain-text message is a single TextPart.
type Message struct {
	Role  Role   `json:"role"`
	Parts []Part `json:"parts"`
}

// NewMessage builds a Message from a role and zero or more parts.
func NewMessage(role Role, parts ...Part) Message {
	return Message{Role: role, Parts: parts}
}

// Text builds a Message with a single TextPart.
func Text(role Role, text string) Message {
	return Message{Role: role, Parts: []Part{TextPart{Text: text}}}
}

// UnmarshalJSON decodes a Message, dispatching each part on its "type" field.
func (m *Message) UnmarshalJSON(data []byte) error {
	var raw struct {
		Role  Role              `json:"role"`
		Parts []json.RawMessage `json:"parts"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	m.Role = raw.Role
	m.Parts = make([]Part, 0, len(raw.Parts))
	for i, rawPart := range raw.Parts {
		p, err := unmarshalPart(rawPart)
		if err != nil {
			return fmt.Errorf("message part %d: %w", i, err)
		}
		m.Parts = append(m.Parts, p)
	}
	return nil
}

// unmarshalPart reads the "type" discriminator and decodes the matching
// concrete part.
func unmarshalPart(data []byte) (Part, error) {
	var head struct {
		Type PartType `json:"type"`
	}
	if err := json.Unmarshal(data, &head); err != nil {
		return nil, err
	}

	switch head.Type {
	case PartTypeText:
		var p TextPart
		return p, json.Unmarshal(data, &p)
	case PartTypeImage:
		var p ImagePart
		return p, json.Unmarshal(data, &p)
	case PartTypeToolCall:
		var p ToolCallPart
		return p, json.Unmarshal(data, &p)
	case PartTypeToolResult:
		var p ToolResultPart
		return p, json.Unmarshal(data, &p)
	case "":
		return nil, fmt.Errorf("missing %q field", "type")
	default:
		return nil, fmt.Errorf("unknown part type %q", head.Type)
	}
}
