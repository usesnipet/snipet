import { FailoverError, LLMError } from "./llm/errors.js";

export enum CoreErrorCode {
  INVALID_JSON_SCHEMA = "INVALID_JSON_SCHEMA",
  NOT_FOUND = "NOT_FOUND",
  INVALID_DRIVER_OPTIONS = "INVALID_DRIVER_OPTIONS",
}

/** What an error carries besides its message: `details` is public, `cause` is private. */
export interface CoreErrorOptions {
  /** Client-safe structured info, e.g. validation issues. */
  details?: unknown;
  /** The underlying failure, for logs and hooks only; never sent to the client. */
  cause?: unknown;
}

/** An expected failure of the core; `message` and `details` are client-safe. */
export class CoreError extends Error {
  readonly details?: unknown;

  constructor(
    readonly code: CoreErrorCode,
    message: string,
    options: CoreErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CoreError";
    this.details = options.details;
  }
}

/** What the client sees for an LLM run that failed on every target. */
export const FAILOVER_MESSAGE = "all configured llms failed";

/**
 * The client-safe message of an expected error, or undefined for any other,
 * which the caller reports as an internal error.
 */
export function clientMessage(err: unknown): string | undefined {
  if (err instanceof FailoverError) return FAILOVER_MESSAGE;
  if (err instanceof CoreError || err instanceof LLMError) return err.message;
  return undefined;
}
