/** A model's prices in USD per 1M tokens, as usage records store them. */
export interface ModelPrice {
  inputPrice: number;
  outputPrice: number;
  /** Null when the model has no cache price; cached tokens are then charged as input. */
  cachedInputPrice: number | null;
}

/** The fields read from one entry of LiteLLM's model_prices_and_context_window.json; prices are per token. */
interface LiteLLMEntry {
  input_cost_per_token?: unknown;
  output_cost_per_token?: unknown;
  cache_read_input_token_cost?: unknown;
}

const PER_MILLION = 1e6;

/** Per token to per 1M, rounded to the 6 decimals the price columns keep: 3e-6 * 1e6 is 2.9999999999999996. */
const perMillion = (perToken: number) => Math.round(perToken * PER_MILLION * PER_MILLION) / PER_MILLION;

/** The part after the provider prefix: "openai/gpt-4o" is "gpt-4o". */
const withoutProvider = (key: string) => key.slice(key.lastIndexOf("/") + 1);

/**
 * LiteLLM's price list by lowercase model key, each also under its name without the
 * provider prefix, so "gpt-4o" finds "openai/gpt-4o". Unprefixed keys are indexed first and
 * win, as they are the provider's own price. Entries without input and output prices are left out.
 */
export function indexModelPrices(raw: unknown): Map<string, ModelPrice> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("model price list is not an object");

  const prices = new Map<string, ModelPrice>();
  const entries = Object.entries(raw as Record<string, LiteLLMEntry>).sort(
    ([a], [b]) => Number(a.includes("/")) - Number(b.includes("/")),
  );
  for (const [key, entry] of entries) {
    if (key === "sample_spec" || !entry || typeof entry !== "object") continue;
    const { input_cost_per_token: input, output_cost_per_token: output, cache_read_input_token_cost: cached } = entry;
    if (typeof input !== "number" || typeof output !== "number") continue;

    const price: ModelPrice = {
      inputPrice: perMillion(input),
      outputPrice: perMillion(output),
      cachedInputPrice: typeof cached === "number" ? perMillion(cached) : null,
    };
    const name = key.toLowerCase();
    if (!prices.has(name)) prices.set(name, price);
    if (!prices.has(withoutProvider(name))) prices.set(withoutProvider(name), price);
  }
  return prices;
}

/** The price of a model as a connection names it: its exact key first, then without its provider prefix. */
export function findModelPrice(prices: Map<string, ModelPrice>, model: string): ModelPrice | undefined {
  const name = model.toLowerCase();
  return prices.get(name) ?? prices.get(withoutProvider(name));
}
