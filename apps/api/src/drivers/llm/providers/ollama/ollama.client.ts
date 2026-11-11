import { LLMError, LLMErrorCode, llmErrorFromStatus, llmProviderError } from "#src/core/llm/errors.js";
import { safeFetch } from "#src/infra/http/safe-fetch.js";
import { Ollama } from "ollama";
import z from "zod";

/** Unset `{{ connection.x }}` placeholders render as "", which means "not set". */
const unset = (v: unknown) => (v === "" ? undefined : v);

/**
 * Options shared by the ollama drivers. keepAlive, think and options
 * (num_ctx, temperature, ...) are sent with every request.
 */
export const ollamaOptionsSchema = z.strictObject({
  baseUrl: z.url(), // Ollama root, e.g. http://localhost:11434
  headers: z.record(z.string(), z.string()).default({}),
  keepAlive: z.preprocess(unset, z.union([z.string(), z.number()]).optional()),
  // Levels only work on models that grade their effort (gpt-oss); others take on/off.
  think: z
    .preprocess(unset, z.enum(["off", "on", "low", "medium", "high"]).optional())
    .transform((v) => (v === "off" ? false : v === "on" ? true : v)),
  options: z
    .record(z.string(), z.unknown())
    .default({})
    .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => unset(v) !== undefined))),
});
export type OllamaOptions = z.infer<typeof ollamaOptionsSchema>;

/** The SDK has no per-request signal, so it is threaded through its fetch. */
export function ollamaClient({ baseUrl, headers }: OllamaOptions, signal?: AbortSignal): Ollama {
  return new Ollama({
    host: baseUrl,
    headers,
    fetch: (input, init) =>
      safeFetch(input, {
        ...init,
        signal: signal && init?.signal ? AbortSignal.any([signal, init.signal]) : (signal ?? init?.signal),
      }),
  });
}

/**
 * Errors are matched by name, not class: the SDK doesn't export ResponseError,
 * and fetch's errors may come from another realm (undici, jest's vm).
 */
export function toLlmError(err: unknown): unknown {
  if (err instanceof LLMError || typeof err !== "object" || err === null) return err;
  const { name, status_code } = err as Error & { status_code?: unknown };
  if (name === "ResponseError" && typeof status_code === "number") {
    return llmErrorFromStatus(status_code, err);
  }
  // fetch rejects with a TypeError when the server can't be reached.
  if (name === "TypeError" || name === "TimeoutError" || name === "BlockedAddressError")
    return llmProviderError(LLMErrorCode.UNAVAILABLE, err);
  return err;
}
