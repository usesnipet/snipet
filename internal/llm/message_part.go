package llm

import "encoding/json"

// PartType is the discriminator serialised as the "type" field of a part.
type PartType string

const (
	PartTypeText       PartType = "text"
	PartTypeImage      PartType = "image"
	PartTypeToolCall   PartType = "tool_call"
	PartTypeToolResult PartType = "tool_result"
)

// Part is a sealed interface implemented by every message part type
// (TextPart, ImagePart, ToolCallPart, ToolResultPart). Consumers type-switch
// on the concrete type; no other package can implement Part.
type Part interface {
	isPart()
	// Type returns the part's discriminator.
	Type() PartType
}

type part struct{}

func (part) isPart() {}

// TextPart is a run of plain text. Valid in a message of any role.
type TextPart struct {
	part
	Text string `json:"text"`
}

// Type implements Part.
func (TextPart) Type() PartType { return PartTypeText }

// MarshalJSON implements json.Marshaler, adding the "type" discriminator.
func (p TextPart) MarshalJSON() ([]byte, error) {
	type alias TextPart
	return json.Marshal(struct {
		Type PartType `json:"type"`
		alias
	}{PartTypeText, alias(p)})
}

// ImagePart is an image input. Valid in user messages.
type ImagePart struct {
	part
	Source   string `json:"source"`    // url or base64 data
	MimeType string `json:"mime_type"` // e.g. "image/png", "image/jpeg"
}

// Type implements Part.
func (ImagePart) Type() PartType { return PartTypeImage }

// MarshalJSON implements json.Marshaler, adding the "type" discriminator.
func (p ImagePart) MarshalJSON() ([]byte, error) {
	type alias ImagePart
	return json.Marshal(struct {
		Type PartType `json:"type"`
		alias
	}{PartTypeImage, alias(p)})
}

// ToolCallPart is the assistant asking to run a tool. Valid in assistant
// messages; matched to a ToolResultPart by ID.
type ToolCallPart struct {
	part
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// Type implements Part.
func (ToolCallPart) Type() PartType { return PartTypeToolCall }

// MarshalJSON implements json.Marshaler, adding the "type" discriminator.
func (p ToolCallPart) MarshalJSON() ([]byte, error) {
	type alias ToolCallPart
	return json.Marshal(struct {
		Type PartType `json:"type"`
		alias
	}{PartTypeToolCall, alias(p)})
}

// ToolResultPart is the outcome of a ToolCallPart. Valid in tool messages.
type ToolResultPart struct {
	part
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error"`
}

// Type implements Part.
func (ToolResultPart) Type() PartType { return PartTypeToolResult }

// MarshalJSON implements json.Marshaler, adding the "type" discriminator.
func (p ToolResultPart) MarshalJSON() ([]byte, error) {
	type alias ToolResultPart
	return json.Marshal(struct {
		Type PartType `json:"type"`
		alias
	}{PartTypeToolResult, alias(p)})
}
