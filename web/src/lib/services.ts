import type { HttpGetOptions, HttpPostOptions, HttpPutOptions, HttpDeleteOptions, SearchParamsRecord, PathParamsRecord } from "./http";

type WithoutUrl<T> = Omit<T, "url">;

export type ServiceGetOptions<T = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>> =
  WithoutUrl<HttpGetOptions<T, TSearchParams, TPathParams, THeaders>>;

export type ServicePostOptions<B = unknown, T = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>> =
  WithoutUrl<HttpPostOptions<B, T, TSearchParams, TPathParams, THeaders>>;

export type ServicePutOptions<B = unknown, T = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>> =
  WithoutUrl<HttpPutOptions<B, T, TSearchParams, TPathParams, THeaders>>;

export type ServiceDeleteOptions<T = unknown, TSearchParams = SearchParamsRecord, TPathParams = PathParamsRecord, THeaders = Record<string, string>> =
  WithoutUrl<HttpDeleteOptions<T, TSearchParams, TPathParams, THeaders>>;