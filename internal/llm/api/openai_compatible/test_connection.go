package openaicompatible

import (
	"context"
	"fmt"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// testConnection verifies that config can reach and authenticate against
// baseURL by issuing a minimal non-streaming completion request.
func testConnection(ctx context.Context, baseURL string, config jsonx.JSONMap) error {
	cfg, err := NewConfig(config)
	if err != nil {
		return err
	}

	// Keep the probe cheap: one short completion proves auth, endpoint, and model.
	probe := cfg
	if probe.MaxTokens == 0 {
		probe.MaxTokens = 5
	}
	probeConfig, err := jsonx.ToJSONMap(probe)
	if err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}

	_, err = generate(ctx, baseURL, probeConfig, llm.GenerateOptions{
		Prompt: llm.NewPrompt(
			llm.WithMessages([]llm.Message{
				llm.NewMessage(llm.RoleUser, `Respond with "ok"`),
			}),
		),
	})
	if err != nil {
		return fmt.Errorf("failed to generate test response: %w", err)
	}
	return nil
}
