import { findModelPrice, indexModelPrices } from "./model-prices.js";

const list = {
  sample_spec: { input_cost_per_token: 0, output_cost_per_token: 0 },
  "openrouter/gpt-4o": { input_cost_per_token: 0.000009, output_cost_per_token: 0.00002 },
  "gpt-4o": {
    input_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001,
    cache_read_input_token_cost: 0.00000125,
  },
  "ollama/llama3": { input_cost_per_token: 0, output_cost_per_token: 0 },
  "Claude-Sonnet-4-5": { input_cost_per_token: 0.000003, output_cost_per_token: 0.000015 },
  "dall-e-3": { output_cost_per_pixel: 0.00000004 },
};

describe("model prices", () => {
  const prices = indexModelPrices(list);

  it("finds a model by its key, per 1M tokens", () => {
    expect(findModelPrice(prices, "gpt-4o")).toEqual({ inputPrice: 2.5, outputPrice: 10, cachedInputPrice: 1.25 });
  });

  it("rounds to the 6 decimals stored", () => {
    expect(findModelPrice(prices, "claude-sonnet-4-5")?.inputPrice).toBe(3);
  });

  it("finds a model named with a provider prefix, preferring the provider's own price", () => {
    expect(findModelPrice(prices, "azure/gpt-4o")?.inputPrice).toBe(2.5);
    expect(findModelPrice(prices, "openrouter/gpt-4o")?.inputPrice).toBe(9);
  });

  it("finds a prefixed entry by its bare name", () => {
    expect(findModelPrice(prices, "llama3")).toEqual({ inputPrice: 0, outputPrice: 0, cachedInputPrice: null });
  });

  it("leaves out entries without token prices and unknown models", () => {
    expect(findModelPrice(prices, "dall-e-3")).toBeUndefined();
    expect(findModelPrice(prices, "sample_spec")).toBeUndefined();
    expect(findModelPrice(prices, "my-own-model")).toBeUndefined();
  });

  it("rejects a list that isn't an object", () => {
    expect(() => indexModelPrices([])).toThrow();
  });
});
