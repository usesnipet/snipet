import type { CoreErrorOptions } from "../error.js";

/**
 * Error vocabulary shared by drivers, registry and runner. Drivers map
 * their SDK errors onto a code; the runner fails over on some of them.
 */
export enum LLMErrorCode {
  RATE_LIMIT = "RATE_LIMIT",
  UNAVAILABLE = "UNAVAILABLE",
  AUTH = "AUTH",
  BAD_REQUEST = "BAD_REQUEST",
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  LLM_NOT_FOUND = "LLM_NOT_FOUND",
  CONNECTION_NOT_FOUND = "CONNECTION_NOT_FOUND",
}

/**
 * The runner moves to the next target only on these: failures of that target
 * alone (its provider, credentials, manifest or model), which the next may not
 * share. Any other error ends the run.
 */
const FAILOVER = new Set([
  LLMErrorCode.RATE_LIMIT,
  LLMErrorCode.UNAVAILABLE,
  LLMErrorCode.AUTH,
  LLMErrorCode.LLM_NOT_FOUND,
  LLMErrorCode.MODEL_NOT_FOUND,
  LLMErrorCode.CONNECTION_NOT_FOUND,
]);

/**
 * An LLM failure. Like CoreError, `message` and `details` are client-safe;
 * the raw provider error (which may carry hosts or credentials) goes in `cause`.
 */
export class LLMError extends Error {
  readonly details?: unknown;

  constructor(
    readonly code: LLMErrorCode,
    message: string,
    options: CoreErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "LLMError";
    this.details = options.details;
  }

  /** Whether the runner may try the next target. */
  get failover(): boolean {
    return FAILOVER.has(this.code);
  }
}

export const isFailover = (err: unknown): err is LLMError => err instanceof LLMError && err.failover;

/** Client-safe message per code, for errors that wrap a provider's. */
const PROVIDER_MESSAGES: Record<LLMErrorCode, string> = {
  [LLMErrorCode.RATE_LIMIT]: "llm provider rate limited",
  [LLMErrorCode.UNAVAILABLE]: "llm provider unavailable",
  [LLMErrorCode.AUTH]: "llm provider rejected credentials",
  [LLMErrorCode.BAD_REQUEST]: "llm provider rejected the request",
  [LLMErrorCode.MODEL_NOT_FOUND]: "llm model not found",
  [LLMErrorCode.LLM_NOT_FOUND]: "llm not found",
  [LLMErrorCode.CONNECTION_NOT_FOUND]: "llm connection not found",
};

/** Wraps a provider's error: a generic message for `code`, the original kept as `cause`. */
export function llmProviderError(code: LLMErrorCode, cause: unknown): LLMError {
  return new LLMError(code, PROVIDER_MESSAGES[code], { cause });
}

/** Every target failed before producing a result. */
export class FailoverError extends Error {
  constructor(readonly attempts: { connectionId: string; model: string; error: LLMError }[]) {
    super(
      `all ${attempts.length} llm attempts failed: ${attempts.map((a) => `${a.model}: ${a.error.message}`).join("; ")}`,
    );
    this.name = "FailoverError";
  }
}

/**
 * Maps an HTTP status from a provider API onto an error code, like the Go
 * drivers did. Unknown statuses become BAD_REQUEST rather than failing over.
 */
export function llmErrorFromStatus(status: number, cause: unknown): LLMError {
  if (status === 429) return llmProviderError(LLMErrorCode.RATE_LIMIT, cause);
  if (status === 401 || status === 403) return llmProviderError(LLMErrorCode.AUTH, cause);
  if (status === 404) return llmProviderError(LLMErrorCode.MODEL_NOT_FOUND, cause);
  if (status >= 500) return llmProviderError(LLMErrorCode.UNAVAILABLE, cause);
  return llmProviderError(LLMErrorCode.BAD_REQUEST, cause);
}
