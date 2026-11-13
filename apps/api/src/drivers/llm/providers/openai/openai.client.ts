import { LLMError, LLMErrorCode, llmErrorFromStatus, llmProviderError } from "#src/core/llm/errors.js";
import { safeFetch } from "#src/infra/http/safe-fetch.js";
import OpenAI, { APIConnectionError, APIError, APIUserAbortError } from "openai";
import z from "zod";

/**
 * Options shared by the openai drivers. Any OpenAI-compatible service (Groq,
 * Together, OpenRouter, Ollama, ...) works with its own baseUrl.
 */
export const openAiOptionsSchema = z.strictObject({
  baseUrl: z.url(), // SDK base, e.g. https://api.openai.com/v1
  apiKey: z.string().default(""),
  organization: z.string().default(""),
  headers: z.record(z.string(), z.string()).default({}),
  // "" is an unset `{{ connection.temperature }}`; left out, the model's own
  // default applies (reasoning models reject any other).
  temperature: z.preprocess((v) => (v === "" ? undefined : v), z.number().optional()),
});
export type OpenAiOptions = z.infer<typeof openAiOptionsSchema>;

export function openAiClient({ baseUrl, apiKey, headers, organization }: OpenAiOptions): OpenAI {
  return new OpenAI({
    apiKey: apiKey || "none",
    baseURL: baseUrl,
    organization: organization,
    defaultHeaders: headers,
    maxRetries: 0,
    fetch: safeFetch,
  });
}

export function toLlmError(err: unknown): unknown {
  if (err instanceof LLMError || err instanceof APIUserAbortError) return err;
  if (err instanceof APIConnectionError) return llmProviderError(LLMErrorCode.UNAVAILABLE, err);
  if (err instanceof APIError && typeof err.status === "number") {
    return llmErrorFromStatus(err.status, err);
  }
  return err;
}
