package openaicompatible

import (
	"encoding/json"
	"strings"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// --- request ----------------------------------------------------------

type chatMessage struct {
	Role       string         `json:"role"`
	Content    any            `json:"content,omitempty"` // string, or []contentPart for images
	ToolCalls  []wireToolCall `json:"tool_calls,omitempty"`
	ToolCallID string         `json:"tool_call_id,omitempty"`
}

type contentPart struct {
	Type     string        `json:"type"` // "text" | "image_url"
	Text     string        `json:"text,omitempty"`
	ImageURL *imageURLPart `json:"image_url,omitempty"`
}

type imageURLPart struct {
	URL string `json:"url"`
}

type wireTool struct {
	Type     string       `json:"type"` // always "function"
	Function wireToolFunc `json:"function"`
}

type wireToolFunc struct {
	Name        string        `json:"name"`
	Description string        `json:"description,omitempty"`
	Parameters  jsonx.JSONMap `json:"parameters,omitempty"`
}

type wireToolCall struct {
	ID       string `json:"id,omitempty"`
	Type     string `json:"type"` // "function"
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"` // JSON encoded as a string
	} `json:"function"`
}

// buildBody assembles the /chat/completions request body. The provider's
// per-call ExtraOptions (temperature, max_tokens, response_format, ...) are
// overlaid as top-level fields.
func buildBody(req llm.GenerateRequest, stream bool) jsonx.JSONMap {
	body := jsonx.JSONMap{
		"model":    req.Model,
		"messages": toChatMessages(req.Messages),
		"stream":   stream,
	}
	if tools := toChatTools(req.Tools); len(tools) > 0 {
		body["tools"] = tools
	}
	for k, v := range req.ExtraOptions {
		if k == "model" || k == "messages" || k == "stream" || k == "tools" {
			continue
		}
		body[k] = v
	}
	return body
}

func toChatMessages(msgs []llm.Message) []chatMessage {
	out := make([]chatMessage, 0, len(msgs))
	for _, m := range msgs {
		cm := chatMessage{Role: string(m.Role)}

		var text strings.Builder
		var parts []contentPart
		hasImage := false

		for _, part := range m.Parts {
			switch p := part.(type) {
			case llm.TextPart:
				text.WriteString(p.Text)
				parts = append(parts, contentPart{Type: "text", Text: p.Text})
			case llm.ImagePart:
				hasImage = true
				parts = append(parts, contentPart{
					Type:     "image_url",
					ImageURL: &imageURLPart{URL: imageURL(p)},
				})
			case llm.ToolCallPart:
				tc := wireToolCall{ID: p.ID, Type: "function"}
				tc.Function.Name = p.Name
				tc.Function.Arguments = string(p.Arguments)
				cm.ToolCalls = append(cm.ToolCalls, tc)
			case llm.ToolResultPart:
				cm.ToolCallID = p.ToolCallID
				text.WriteString(p.Content)
			}
		}

		if hasImage {
			cm.Content = parts
		} else if text.Len() > 0 {
			cm.Content = text.String()
		}
		out = append(out, cm)
	}
	return out
}

func toChatTools(tools []llm.Tool) []wireTool {
	if len(tools) == 0 {
		return nil
	}
	out := make([]wireTool, 0, len(tools))
	for _, t := range tools {
		out = append(out, wireTool{
			Type: "function",
			Function: wireToolFunc{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		})
	}
	return out
}

// imageURL returns a value usable as an OpenAI image_url: an http(s) URL or a
// data: URI passes through; a bare base64 payload is wrapped in a data URI.
func imageURL(p llm.ImagePart) string {
	s := strings.TrimSpace(p.Source)
	if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") || strings.HasPrefix(s, "data:") {
		return s
	}
	mime := p.MimeType
	if mime == "" {
		mime = "image/png"
	}
	return "data:" + mime + ";base64," + s
}

// --- response ----------------------------------------------------------

type chatCompletion struct {
	Choices []struct {
		Message struct {
			Role      string         `json:"role"`
			Content   string         `json:"content"`
			ToolCalls []wireToolCall `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

type errorEnvelope struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

func toResponse(cc chatCompletion) (llm.Response, error) {
	if len(cc.Choices) == 0 {
		return llm.Response{}, errNoChoices
	}
	choice := cc.Choices[0]

	var parts []llm.Part
	if choice.Message.Content != "" {
		parts = append(parts, llm.TextPart{Text: choice.Message.Content})
	}
	for _, tc := range choice.Message.ToolCalls {
		parts = append(parts, llm.ToolCallPart{
			ID:        tc.ID,
			Name:      tc.Function.Name,
			Arguments: json.RawMessage(tc.Function.Arguments),
		})
	}

	return llm.Response{
		Message:      llm.Message{Role: llm.RoleAssistant, Parts: parts},
		FinishReason: finishReason(choice.FinishReason, len(choice.Message.ToolCalls) > 0),
		Usage: llm.Usage{
			InputTokens:  cc.Usage.PromptTokens,
			OutputTokens: cc.Usage.CompletionTokens,
		},
	}, nil
}

func finishReason(raw string, hasToolCalls bool) llm.FinishReason {
	switch raw {
	case "length":
		return llm.FinishLength
	case "tool_calls", "function_call":
		return llm.FinishToolCall
	case "stop":
		return llm.FinishStop
	default:
		if hasToolCalls {
			return llm.FinishToolCall
		}
		return llm.FinishStop
	}
}
