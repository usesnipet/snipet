package ollama

import (
	"context"
	"strings"

	"github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Generate implements llm.Generator via Ollama's OpenAI-compatible endpoint.
func (p *Provider) Generate(ctx context.Context, req llm.GenerateRequest) (llm.Response, error) {
	compatReq, err := p.toCompatRequest(req)
	if err != nil {
		return llm.Response{}, err
	}
	return openaicompatible.Generate(ctx, compatReq)
}

// Stream implements llm.Streamer via Ollama's OpenAI-compatible endpoint.
func (p *Provider) Stream(ctx context.Context, req llm.GenerateRequest) (llm.StreamIterator, error) {
	compatReq, err := p.toCompatRequest(req)
	if err != nil {
		return nil, err
	}
	return openaicompatible.Stream(ctx, compatReq)
}

// toCompatRequest resolves req's connection options against Ollama's own
// schema (applying its base_url default) and rewrites them for the
// openai_compatible client: base_url pointed at Ollama's /v1 endpoint, and
// any auth section forwarded as-is (Ollama needs none by default, but may sit
// behind an authenticating proxy).
func (p *Provider) toCompatRequest(req llm.GenerateRequest) (llm.GenerateRequest, error) {
	connOpts, err := toOllamaConnectionOptions(p.Info(), req.ConnectionOptions)
	if err != nil {
		return llm.GenerateRequest{}, err
	}

	base := strings.TrimSuffix(strings.TrimRight(connOpts.Config.BaseURL, "/"), "/v1") + "/v1"
	compatOpts := jsonx.JSONMap{"config": jsonx.JSONMap{"base_url": base}}
	if auth := llm.AuthSection(req.ConnectionOptions); len(auth) > 0 {
		compatOpts["auth"] = auth
	}

	req.ConnectionOptions = compatOpts
	return req, nil
}
