package llm

// Prompt is the input to an LLM call: an optional system instruction plus
// the conversation history to continue from.
type Prompt struct {
	System   string
	Messages []Message
}

// PromptOption configures a Prompt built via NewPrompt.
type PromptOption func(*Prompt)

// WithSystem sets the prompt's system instruction.
func WithSystem(system string) PromptOption {
	return func(prompt *Prompt) {
		prompt.System = system
	}
}

// WithMessages sets the prompt's conversation history.
func WithMessages(messages []Message) PromptOption {
	return func(prompt *Prompt) {
		prompt.Messages = messages
	}
}

// NewPrompt builds a Prompt from the given PromptOptions.
func NewPrompt(options ...PromptOption) Prompt {
	prompt := Prompt{}
	for _, option := range options {
		option(&prompt)
	}
	return prompt
}
