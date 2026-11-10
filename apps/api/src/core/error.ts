export enum CoreErrorCode {
  INVALID_JSON_SCHEMA = "INVALID_JSON_SCHEMA",
  NOT_FOUND = "NOT_FOUND",
  INVALID_DRIVER_OPTIONS = "INVALID_DRIVER_OPTIONS",
}

export class CoreError extends Error {
  constructor(
    public readonly code: CoreErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message, { cause: details });
    this.name = "CoreError";
  }
}
