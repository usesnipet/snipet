package openaicompatible

import (
	"context"
	"fmt"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// TestConnection verifies that options can reach and authenticate against
// baseURL by issuing a minimal non-streaming completion request.
func TestConnection(ctx context.Context, baseURL string, options llm.TestConnectionOptions) error {
	genCfg, err := NewGenerateConfig(options.GenerateConfig)
	if err != nil {
		return err
	}

	// Keep the probe cheap: one short completion proves auth, endpoint, and model.
	probe := genCfg
	if probe.MaxTokens == 0 {
		probe.MaxTokens = 5
	}
	probeGenerateConfig, err := jsonx.ToJSONMap(probe)
	if err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}

	_, err = Generate(ctx, baseURL, llm.GenerateOptions{
		AuthConfig:     options.AuthConfig,
		GenerateConfig: probeGenerateConfig,
		Messages: []llm.Message{
			llm.NewMessage(llm.RoleUser, `Respond with "ok"`),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to generate test response: %w", err)
	}
	return nil
}
