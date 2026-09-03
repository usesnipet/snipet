import { z, ZodType } from "zod";

import { logger } from "../logger";

import { handleApiError, parseZodErrors } from "./errors";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";
export type SearchParamsRecord = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | undefined | null
>;

export type PathParamsRecord = Record<string, string | number | boolean>;

export type ApiRequestOptions<
  TBody = unknown,
  TResponse = unknown,
  TSearchParams = SearchParamsRecord,
  TPathParams = PathParamsRecord,
  THeaders = Record<string, string>
> = {
  method: ApiMethod;
  url: string;
  body?: TBody;
  headers?: THeaders;
  params?: TPathParams;
  searchParams?: TSearchParams;
  schemas?: {
    body?: ZodType<TBody>;
    response?: ZodType<TResponse>;
    searchParams?: ZodType<TSearchParams>;
    pathParams?: ZodType<TPathParams>;
    headers?: ZodType<THeaders>;
  }
};

export function applyPathParams(url: string, params: PathParamsRecord): string {
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{${key}}`, encodeURIComponent(String(value))),
    url,
  );
}

export function buildSearchParams(params: SearchParamsRecord): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    searchParams.append(key, String(value));
  }

  return searchParams.toString();
}

export function applySearchParams(
  url: string,
  params: SearchParamsRecord,
): string {
  const query = buildSearchParams(params);
  if (!query) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${query}`;
}

export async function httpx<TResponse = unknown, TBody = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(
  options: ApiRequestOptions<TBody, TResponse, TSearchParams, TPathParams, THeaders>,
): Promise<TResponse> {
  const { url, method, schemas } = options;
  let { body, headers, params, searchParams } = options;
  const pathUrl = params ? applyPathParams(url, params as PathParamsRecord) : url;

  try {
    if (schemas?.pathParams && params) params = schemas.pathParams.parse(params);
    if (schemas?.searchParams && searchParams) searchParams = schemas.searchParams.parse(searchParams);
    if (schemas?.headers && headers) headers = schemas.headers.parse(headers as Record<string, string>);
    if (schemas?.body) body = schemas.body.parse(body);
  } catch (error) {
    logger.error(error);
    if (error instanceof z.ZodError) throw parseZodErrors(error);
    throw error;
  }

  const requestUrl = searchParams
    ? applySearchParams(pathUrl, searchParams as SearchParamsRecord)
    : pathUrl;

  const response = await fetch(requestUrl, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const json = await response.json();
  if (schemas?.response) {
    const parsed = schemas.response.safeParse(json);

    if (parsed.success) return parsed.data;
    logger.warn("Invalid response", parsed.error);
    throw parseZodErrors(parsed.error, "Invalid response");
  }
  return json as TResponse;
}


export type HttpGetOptions<
  TResponse = unknown,
  TSearchParams = SearchParamsRecord,
  TPathParams = PathParamsRecord,
  THeaders = Record<string, string>
> = Omit<ApiRequestOptions<undefined, TResponse, TSearchParams, TPathParams, THeaders>, "method" | "body">;
export function httpGet<TResponse = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpGetOptions<TResponse, TSearchParams, TPathParams, THeaders>): Promise<TResponse> {
  return httpx<TResponse, undefined, TSearchParams, TPathParams, THeaders>({ ...options, method: "GET" });
}

export type HttpPostOptions<
  TBody = unknown,
  TResponse = unknown,
  TSearchParams = SearchParamsRecord,
  TPathParams = PathParamsRecord,
  THeaders = Record<string, string>
> = Omit<ApiRequestOptions<TBody, TResponse, TSearchParams, TPathParams, THeaders>, "method">;
export function httpPost<TResponse = unknown, TBody = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpPostOptions<TBody, TResponse, TSearchParams, TPathParams, THeaders>): Promise<TResponse> {
  return httpx<TResponse, TBody, TSearchParams, TPathParams, THeaders>({ ...options, method: "POST" });
}

export type HttpPutOptions<
  TBody = unknown,
  TResponse = unknown,
  TSearchParams = SearchParamsRecord,
  TPathParams = PathParamsRecord,
  THeaders = Record<string, string>
> = Omit<ApiRequestOptions<TBody, TResponse, TSearchParams, TPathParams, THeaders>, "method">;
export function httpPut<TResponse = unknown, TBody = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpPutOptions<TBody, TResponse, TSearchParams, TPathParams, THeaders>): Promise<TResponse> {
  return httpx<TResponse, TBody, TSearchParams, TPathParams, THeaders>({ ...options, method: "PUT" });
}

export type HttpDeleteOptions<
  TResponse = unknown,
  TSearchParams = SearchParamsRecord,
  TPathParams = PathParamsRecord,
  THeaders = Record<string, string>
> = Omit<ApiRequestOptions<undefined, TResponse, TSearchParams, TPathParams, THeaders>, "method" | "body">;
export function httpDelete<TResponse = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpDeleteOptions<TResponse, TSearchParams, TPathParams, THeaders>): Promise<TResponse> {
  return httpx<TResponse, undefined, TSearchParams, TPathParams, THeaders>({ ...options, method: "DELETE" });
}

export class HttpClient {
  private readonly defaultHeaders: Record<string, string>;

  constructor(defaultHeaders: Record<string, string> = {}) {
    this.defaultHeaders = defaultHeaders;
  }

  get = <T = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpGetOptions<T, TSearchParams, TPathParams, THeaders>) =>
    httpGet<T, TSearchParams, TPathParams, THeaders>({
      ...options,
      headers: { ...this.defaultHeaders, ...(options.headers as Record<string, string> | undefined) } as THeaders,
    });
  post = <T = unknown, B = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpPostOptions<B, T, TSearchParams, TPathParams, THeaders>) =>
    httpPost<T, B, TSearchParams, TPathParams, THeaders>({
      ...options,
      headers: { ...this.defaultHeaders, ...(options.headers as Record<string, string> | undefined) } as THeaders,
    });
  put = <T = unknown, B = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpPutOptions<B, T, TSearchParams, TPathParams, THeaders>) =>
    httpPut<T, B, TSearchParams, TPathParams, THeaders>({
      ...options,
      headers: { ...this.defaultHeaders, ...(options.headers as Record<string, string> | undefined) } as THeaders,
    });
  delete = <T = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>>(options: HttpDeleteOptions<T, TSearchParams, TPathParams, THeaders>) =>
    httpDelete<T, TSearchParams, TPathParams, THeaders>({
      ...options,
      headers: { ...this.defaultHeaders, ...(options.headers as Record<string, string> | undefined) } as THeaders,
    });

  withHeaders(headers: Record<string, string>): HttpClient {
    return new HttpClient({ ...this.defaultHeaders, ...headers });
  }
}