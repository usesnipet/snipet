package llm

// FinishReason says why the model stopped generating.
type FinishReason string

const (
	FinishStop     FinishReason = "stop"      // natural end of the reply
	FinishLength   FinishReason = "length"    // hit the output token cap
	FinishToolCall FinishReason = "tool_call" // stopped to call a tool
)

// Usage is the token accounting for a Generate or Stream call.
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Response is the result of Generator.Generate.
type Response struct {
	Message      Message      `json:"message"`
	FinishReason FinishReason `json:"finish_reason"`
	Usage        Usage        `json:"usage"`
}
