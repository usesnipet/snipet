import qs from "qs";

export type RequestConfig<TData = unknown> = {
  url?: string
  method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
  params?: object
  data?: TData | FormData
  responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream'
  signal?: AbortSignal
  headers?: HeadersInit
}

export type ResponseConfig<TData = unknown> = {
  data: TData
  status: number
  statusText: string
}

export type ApiErrorBody = {
  message: string
  error: string
  statusCode: number
}

export class ApiHttpError<TError = unknown> extends Error {
  readonly status: number
  readonly statusText: string
  readonly body: TError

  constructor(status: number, statusText: string, body: TError) {
    super(resolveErrorMessage(body, status, statusText))
    this.name = "ApiHttpError"
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

/** Used by Kubb-generated clients for the error generic slot. */
export type ResponseErrorConfig<TError = unknown> = ApiHttpError<TError>

export type Client = <TData, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
) => Promise<ResponseConfig<TData>>

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as ApiErrorBody).message === "string"
  );
}

function resolveErrorMessage(body: unknown, status: number, statusText: string): string {
  if (isApiErrorBody(body)) return body.message;
  if (typeof body === "string" && body.length > 0) return body;
  return statusText || `Request failed with status ${status}`;
}

export function isApiHttpError<TError = unknown>(
  error: unknown,
): error is ApiHttpError<TError> {
  return error instanceof ApiHttpError;
}

export function getApiErrorMessage(error: unknown, fallback = "Try again."): string {
  if (isApiHttpError(error)) return error.message;
  if (error instanceof Error) return error.message;
  if (isApiErrorBody(error)) return error.message;
  return fallback;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return text.length > 0 ? text : null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildUrlWithParams(url: string, params?: object): string {
  if (!params || !Object.keys(params).length) return url;

  const query = qs.stringify(params, {
    arrayFormat: "repeat",
    skipNulls: true,
    encodeValuesOnly: true,
  });

  return query ? `${url}?${query}` : url;
}

export const client: Client = async <TData, TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
): Promise<ResponseConfig<TData>> => {
  const headers = new Headers(config.headers ?? undefined)
  if (config.data !== undefined && !(config.data instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const url = buildUrlWithParams(config.url!, config.params);

  let response: Response;
  try {
    response = await fetch(url, {
      method: config.method.toUpperCase(),
      body:
        config.data !== undefined && !(config.data instanceof FormData)
          ? JSON.stringify(config.data)
          : (config.data as BodyInit | undefined),
      signal: config.signal,
      headers,
    })
  } catch (cause) {
    throw new ApiHttpError<TError>(0, "Network error", {
      message: cause instanceof Error ? cause.message : "Network error",
      error: "NetworkError",
      statusCode: 0,
    } as TError)
  }

  const body = await parseResponseBody(response)

  if (!response.ok) {
    throw new ApiHttpError<TError>(response.status, response.statusText, body as TError)
  }

  return {
    data: body as TData,
    status: response.status,
    statusText: response.statusText,
  }
}

export default client;
