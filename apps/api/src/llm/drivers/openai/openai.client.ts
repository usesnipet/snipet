import OpenAI, { APIConnectionError, APIError, APIUserAbortError } from "openai";
import z from "zod";

import { LlmError, llmErrorFromStatus } from "../../errors.js";

// Options shared by the openai drivers. Any OpenAI-compatible service (Groq,
// Together, OpenRouter, Ollama, ...) works with its own baseUrl.
export const openAiOptionsSchema = z.strictObject({
  baseUrl: z.url(), // SDK base, e.g. https://api.openai.com/v1
  apiKey: z.string().default(""),
  organization: z.string().default(""),
  headers: z.record(z.string(), z.string()).default({}),
});
export type OpenAiOptions = z.infer<typeof openAiOptionsSchema>;

export function openAiClient({ baseUrl, apiKey, headers, organization }: OpenAiOptions): OpenAI {
  return new OpenAI({
    apiKey: apiKey || "none",
    baseURL: baseUrl,
    organization: organization,
    defaultHeaders: headers,
    maxRetries: 0,
  });
}

export function toLlmError(err: unknown): unknown {
  if (err instanceof LlmError || err instanceof APIUserAbortError) return err;
  if (err instanceof APIConnectionError) return new LlmError("unavailable", `openai: ${err.message}`);
  if (err instanceof APIError && typeof err.status === "number") {
    return llmErrorFromStatus(err.status, `openai: ${err.message}`);
  }
  return err;
}
