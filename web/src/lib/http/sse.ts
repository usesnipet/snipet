import { z, ZodType } from "zod";

import { logger } from "../logger";

import { handleApiError, parseZodErrors } from "./errors";
import { applyPathParams, applySearchParams } from "./http";

import type { ApiMethod, PathParamsRecord, SearchParamsRecord } from "./http";
export type SseEventHandler = (event: string, data: unknown) => void;

export type HttpSseOptions<TBody = unknown> = {
  url: string;
  method?: ApiMethod;
  body?: TBody;
  headers?: Record<string, string>;
  params?: PathParamsRecord;
  searchParams?: SearchParamsRecord;
  signal?: AbortSignal;
  schemas?: {
    body?: ZodType<TBody>;
  };
  onEvent: SseEventHandler;
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");

    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: SseEventHandler,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const frame = parseSseBlock(trimmed);
        if (!frame) continue;

        let data: unknown = frame.data;
        try {
          data = JSON.parse(frame.data);
        } catch {
          // keep raw string when data is not JSON
        }
        onEvent(frame.event, data);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function httpSse<TBody = unknown>(
  options: HttpSseOptions<TBody>,
): Promise<void> {
  const {
    url,
    method = "POST",
    schemas,
    signal,
    onEvent,
  } = options;
  const { params, searchParams, headers } = options;
  let { body } = options;
  const pathUrl = params ? applyPathParams(url, params) : url;

  try {
    if (schemas?.body) body = schemas.body.parse(body);
  } catch (error) {
    logger.error(error);
    if (error instanceof z.ZodError) throw parseZodErrors(error);
    throw error;
  }

  const requestUrl = searchParams
    ? applySearchParams(pathUrl, searchParams)
    : pathUrl;

  const response = await fetch(requestUrl, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      Accept: "text/event-stream",
      ...headers,
    },
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  if (!response.body) {
    throw new Error("SSE response has no body");
  }

  await readSseStream(response.body, onEvent, signal);
}
