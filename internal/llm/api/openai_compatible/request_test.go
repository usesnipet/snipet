package openaicompatible

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usesnipet/snipet/internal/llm"
)

func TestBuildChatParams(t *testing.T) {
	cfg := Config{
		Model:       "gpt-4o-mini",
		Temperature: 0.5,
		MaxTokens:   100,
		TopP:        0.9,
	}
	options := llm.GenerateOptions{
		Prompt: llm.NewPrompt(
			llm.WithSystem("You are helpful."),
			llm.WithMessages([]llm.Message{
				llm.NewMessage(llm.RoleUser, "Hello"),
				llm.NewMessage(llm.RoleAssistant, "Hi"),
				llm.NewMessage(llm.RoleUser, "How are you?"),
			}),
		),
	}

	params := buildChatParams(cfg, options)
	require.Equal(t, "gpt-4o-mini", string(params.Model))
	require.True(t, params.Temperature.Valid())
	require.Equal(t, 0.5, params.Temperature.Value)
	require.True(t, params.MaxTokens.Valid())
	require.Equal(t, int64(100), params.MaxTokens.Value)
	require.True(t, params.TopP.Valid())
	require.Equal(t, 0.9, params.TopP.Value)

	require.Len(t, params.Messages, 4)
	require.NotNil(t, params.Messages[0].OfSystem)
	require.Equal(t, "You are helpful.", params.Messages[0].OfSystem.Content.OfString.Value)
	require.NotNil(t, params.Messages[1].OfUser)
	require.NotNil(t, params.Messages[2].OfAssistant)
	require.NotNil(t, params.Messages[3].OfUser)
	require.Equal(t, "How are you?", params.Messages[3].OfUser.Content.OfString.Value)

	require.Len(t, params.Tools, 1)
	require.NotNil(t, params.Tools[0].OfFunction)
	require.Equal(t, "get_weather", params.Tools[0].OfFunction.Function.Name)
	require.Equal(t, "Get weather", params.Tools[0].OfFunction.Function.Description.Value)

	payload, err := json.Marshal(params)
	require.NoError(t, err)
	require.Contains(t, string(payload), `"tools"`)
}

func TestBuildChatParamsOmitsZeroOptionalFields(t *testing.T) {
	params := buildChatParams(Config{Model: "m"}, llm.GenerateOptions{
		Prompt: llm.NewPrompt(llm.WithMessages([]llm.Message{
			llm.NewMessage(llm.RoleUser, "hi"),
		})),
	})
	require.False(t, params.Temperature.Valid())
	require.False(t, params.TopP.Valid())
	require.False(t, params.MaxTokens.Valid())
	require.Nil(t, params.Tools)
	require.Len(t, params.Messages, 1)
}
func TestResolveBaseURL(t *testing.T) {
	url, err := resolveBaseURL("https://api.openai.com/v1", Config{})
	require.NoError(t, err)
	require.Equal(t, "https://api.openai.com/v1", url)

	url, err = resolveBaseURL("https://api.openai.com/v1", Config{Endpoint: "https://proxy.example/v1/"})
	require.NoError(t, err)
	require.Equal(t, "https://proxy.example/v1", url)

	url, err = resolveBaseURL("https://api.openai.com/v1/", Config{})
	require.NoError(t, err)
	require.Equal(t, "https://api.openai.com/v1", url)

	_, err = resolveBaseURL("", Config{})
	require.Error(t, err)
}

func TestConfigValidate(t *testing.T) {
	require.Error(t, Config{}.validate())
	require.NoError(t, Config{Model: "gpt"}.validate())
}
