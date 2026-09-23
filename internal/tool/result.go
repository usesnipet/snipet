package tool

// Result is the outcome of executing a tool, in the shape a model consumes
// (see llm.ToolResultPart). IsError marks a failure the model should see and
// may recover from, like invalid arguments or an unreachable server.
type Result struct {
	Content string `json:"content"`
	IsError bool   `json:"is_error"`
}
