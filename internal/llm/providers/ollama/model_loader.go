package ollama

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	llm "github.com/usesnipet/snipet/internal/llm"
	openaicompatible "github.com/usesnipet/snipet/internal/llm/api/openai_compatible"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// modelLoader lists the models actually installed on the local Ollama
// instance, since (unlike hosted providers) they vary per user/machine
// instead of being a fixed catalog. It uses Ollama's native /api/tags
// endpoint, since Ollama has no OpenAI-compatible /v1/models route.
// https://docs.ollama.com/api/tags
var modelLoader = llm.ModelLoader{
	Models: listModels,
	Model:  getModel,
}

type capabilities string

const (
	CapabilitiesVision     = "vision"
	CapabilitiesCompletion = "completion"
	CapabilitiesTools      = "tools"
	CapabilitiesThinking   = "thinking"
)

type tagsResponse struct {
	Models []struct {
		Name         string         `json:"name"`
		Model        string         `json:"model"`
		Size         int            `json:"size"`
		Format       string         `json:"format"`
		Capabilities []capabilities `json:"capabilities"`
	} `json:"models"`
}

func capabilitiesToModelCapabilities(capabilities []capabilities) []llm.ModelCapabilities {
	modelCapabilities := make([]llm.ModelCapabilities, 0, len(capabilities))
	for _, capability := range capabilities {
		switch capability {
		case CapabilitiesCompletion:
			modelCapabilities = append(modelCapabilities, llm.ModelCapabilitiesStreaming)
		case CapabilitiesTools:
			modelCapabilities = append(modelCapabilities, llm.ModelCapabilitiesToolCall)
		}
	}
	return modelCapabilities
}

func listModels(ctx context.Context, config jsonx.JSONMap) ([]llm.Model, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, tagsURL(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build tags request: %w", err)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach ollama: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama tags request failed with status %d", res.StatusCode)
	}

	var tags tagsResponse
	if err := json.NewDecoder(res.Body).Decode(&tags); err != nil {
		return nil, fmt.Errorf("failed to decode ollama tags response: %w", err)
	}

	models := make([]llm.Model, 0, len(tags.Models))
	for _, model := range tags.Models {
		models = append(models, llm.NewModel(model.Model, "", capabilitiesToModelCapabilities(model.Capabilities)))
	}

	return models, nil
}

func getModel(ctx context.Context, config jsonx.JSONMap) (llm.Model, error) {
	cfg, err := openaicompatible.NewGenerateConfig(config)
	if err != nil {
		return llm.Model{}, err
	}

	models, err := listModels(ctx, config)
	if err != nil {
		return llm.Model{}, err
	}

	for _, model := range models {
		if model.Name == cfg.Model {
			return model, nil
		}
	}

	return llm.Model{}, llm.ErrModelNotFound
}

// tagsURL derives Ollama's native /api/tags endpoint from the
// OpenAI-compatible base URL used by the rest of this provider.
func tagsURL(baseURL string) string {
	return strings.TrimSuffix(baseURL, "/v1") + "/api/tags"
}
