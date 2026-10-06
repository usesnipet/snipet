import type { PathParamsRecord, SearchParamsRecord } from "./http";

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
