import { z } from "zod";

export type ApiErrorDetails = Record<string, unknown>;

export type ApiErrorBody = {
  statusCode?: number;
  message: string;
  details?: ApiErrorDetails | null;
};

export class ApiError extends Error {
  readonly statusCode?: number;
  readonly details: ApiErrorDetails | null;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.statusCode = body.statusCode;
    this.details = body.details ?? null;
  }

  static is(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.statusCode === "number" &&
    typeof record.message === "string"
  );
}

function fallbackApiError(response: Response): ApiError {
  return new ApiError({
    statusCode: response.status,
    message: response.statusText || "Request failed",
    details: null,
  });
}

export async function parseApiErrorResponse(
  response: Response,
): Promise<ApiError> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return fallbackApiError(response);
  }

  try {
    const body: unknown = await response.json();
    if (isApiErrorBody(body)) {
      return new ApiError({
        statusCode: body.statusCode || response.status,
        message: body.message,
        details: body.details ?? null,
      });
    }
  } catch {
    // ignore malformed JSON
  }

  return fallbackApiError(response);
}

export function parseZodErrors(error: z.ZodError, message?: string): ApiError {
  const errors = z.treeifyError(error).errors;

  return new ApiError({
    message: message ?? errors[0],
    details: { errors },
  });
}

export async function handleApiError(response: Response): Promise<never> {
  throw await parseApiErrorResponse(response);
}