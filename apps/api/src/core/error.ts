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
