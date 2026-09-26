package openaicompatible

import (
	"context"
	"fmt"

	"resty.dev/v3"

	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Models lists the models served at GET /models. The endpoint carries no
// capability data, so every model is reported as a streaming, tool-capable
// text model.
func Models(ctx context.Context, connectionOptions jsonx.JSONMap) ([]llm.Model, error) {
	cfg, err := configFromOptions(connectionOptions)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", llm.ErrBadRequest, err)
	}

	client := resty.New()
	defer client.Close()

	var out struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	var apiErr errorEnvelope
	resp, err := newRequest(ctx, client, cfg).
		SetResult(&out).
		SetResultError(&apiErr).
		Get("/models")
	if err != nil {
		return nil, transportErr(err)
	}
	if resp.IsStatusFailure() {
		return nil, statusErr(resp.StatusCode(), apiErr.Error.Message)
	}

	models := make([]llm.Model, 0, len(out.Data))
	for _, m := range out.Data {
		models = append(models, llm.Model{
			Key:          m.ID,
			Name:         m.ID,
			Capabilities: []llm.Capability{llm.CapabilityText, llm.CapabilityStreaming, llm.CapabilityTools},
		})
	}
	return models, nil
}
