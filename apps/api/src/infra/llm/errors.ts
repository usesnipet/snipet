// Error vocabulary shared by providers, registry and runner. Providers map
// their SDK errors onto a kind; the runner fails over on some of them.
export type LlmErrorKind =
  | "rate_limit"
  | "unavailable"
  | "auth"
  | "invalid_options"
  | "bad_request"
  | "model_not_found"
  | "context_too_long"
  | "provider_not_found";

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

// The runner moves to the next target only on these.
const FAILOVER_KINDS: LlmErrorKind[] = ["rate_limit", "unavailable", "auth"];

export const isFailover = (err: unknown) => err instanceof LlmError && FAILOVER_KINDS.includes(err.kind);

// Client-safe label for a failed attempt: never the raw provider message,
// which may carry hosts or credential details.
export function attemptReason(error: LlmError): string {
  if (error.kind === "rate_limit") return "rate limited";
  if (error.kind === "auth") return "authentication rejected";
  if (error.kind === "unavailable") return "unavailable";
  return "failed";
}

// Every target failed before producing a result.
export class FailoverError extends Error {
  constructor(readonly attempts: { llm: string; error: LlmError }[]) {
    super(
      `all ${attempts.length} llm attempts failed: ${attempts.map((a) => `${a.llm}: ${a.error.message}`).join("; ")}`,
    );
    this.name = "FailoverError";
  }
}

// Maps an HTTP status from a provider API onto an error kind, like the Go
// drivers did. Unknown statuses become "bad_request" rather than failing over.
export function llmErrorFromStatus(status: number, message: string): LlmError {
  if (status === 429) return new LlmError("rate_limit", message);
  if (status === 401 || status === 403) return new LlmError("auth", message);
  if (status === 404) return new LlmError("model_not_found", message);
  if (status >= 500) return new LlmError("unavailable", message);
  return new LlmError("bad_request", message);
}
