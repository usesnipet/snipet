import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { llmConnectionService } from "./service";

import type {
  CreateLlmConnection,
  ExecuteLlm,
  FindLlmConnectionsParams,
  ListProviderModelsParams,
  LlmConnection,
  LlmMessage,
  LlmModel,
  LlmProviderInfo,
  LlmResponse,
  LlmStreamEvent,
  Paginated,
  UpdateLlmConnection,
} from "@snipet/shared";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "llm-connection";

export const listLlmConnectionsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListLlmConnections = (
  opts?: ServiceGetOptions<Paginated<LlmConnection>, FindLlmConnectionsParams>,
): UseQueryResult<Paginated<LlmConnection>, Error> =>
  useQuery({
    queryKey: [...listLlmConnectionsQueryKey(), opts?.searchParams],
    queryFn: () => llmConnectionService.list(opts),
  });

export const llmProvidersQueryKey = () =>
  [BASE_QUERY_KEY, "providers"] as const;
export const useLlmProviders = (
  opts?: ServiceGetOptions<LlmProviderInfo[]>,
): UseQueryResult<LlmProviderInfo[], Error> =>
  useQuery({
    queryKey: llmProvidersQueryKey(),
    queryFn: () => llmConnectionService.listProviders(opts),
  });

export const providerModelsQueryKey = (providerKey: string, searchParams?: ListProviderModelsParams) =>
  [BASE_QUERY_KEY, "providers", providerKey, "models", searchParams] as const;
export const useProviderModels = (
  providerKey: string,
  opts?: ServiceGetOptions<LlmModel[], ListProviderModelsParams>,
): UseQueryResult<LlmModel[], Error> =>
  useQuery({
    queryKey: providerModelsQueryKey(providerKey, opts?.searchParams),
    queryFn: () => llmConnectionService.listProviderModels(providerKey, opts),
    enabled: !!providerKey,
  });

export const llmConnectionQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useLlmConnection = (
  id: string,
  opts?: ServiceGetOptions<LlmConnection>,
): UseQueryResult<LlmConnection, Error> =>
  useQuery({
    queryKey: llmConnectionQueryKey(id),
    queryFn: () => llmConnectionService.findById(id, opts),
    enabled: !!id,
  });

export const useCreateLlmConnection = (
  opts?: ServicePostOptions<CreateLlmConnection, LlmConnection>,
): UseMutationResult<LlmConnection, Error, { data: CreateLlmConnection }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data }) => llmConnectionService.create(data, opts),
    meta: { successMessage: "LLM connection created", errorMessage: "Failed to create LLM connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() }),
  });
};

export const useUpdateLlmConnection = (
  opts?: ServicePutOptions<UpdateLlmConnection, void>,
): UseMutationResult<void, Error, { id: string, data: UpdateLlmConnection }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, id }) => llmConnectionService.update(id, data, opts),
    meta: { successMessage: "LLM connection updated", errorMessage: "Failed to update LLM connection" },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: llmConnectionQueryKey(id) });
    },
  });
};

export const useDeleteLlmConnection = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => llmConnectionService.delete(id, opts),
    meta: { successMessage: "LLM connection deleted", errorMessage: "Failed to delete LLM connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() }),
  });
};

// --- Playground: execute / stream ---

export const useExecuteLlm = (
  opts?: ServicePostOptions<ExecuteLlm, LlmResponse>,
): UseMutationResult<LlmResponse, Error, { data: ExecuteLlm }> =>
  useMutation({
    mutationFn: ({ data }) => llmConnectionService.execute(data, opts),
    meta: { errorMessage: "Failed to execute LLM" },
  });

export type LlmSkippedEvent = Extract<LlmStreamEvent, { event: "llm_skipped" }>["data"];
export type LlmToolCallEvent = Extract<LlmStreamEvent, { event: "tool_call" }>["data"];

export type LlmStreamStatus = "idle" | "streaming" | "done" | "error";

export type UseExecuteLlmStreamResult = {
  status: LlmStreamStatus;
  events: LlmStreamEvent[];
  /** The target currently streaming, e.g. "openai/gpt-4o"; null before the first llm starts. */
  activeLlm: string | null;
  /** Targets skipped over during failover, in the order they were tried. */
  skipped: LlmSkippedEvent[];
  text: string;
  toolCalls: LlmToolCallEvent[];
  /** The full assistant message, set once the stream ends cleanly. */
  message: LlmMessage | null;
  error: Error | null;
  execute: (data: ExecuteLlm) => Promise<void>;
  cancel: () => void;
};

// useExecuteLlmStream drives POST /execute/stream: `execute` opens the SSE
// connection and accumulates text_delta/tool_call events as they arrive,
// `cancel` aborts an in-flight run. Not react-query — there is no cached
// value to key on, only a live event stream.
export const useExecuteLlmStream = (): UseExecuteLlmStreamResult => {
  const [status, setStatus] = useState<LlmStreamStatus>("idle");
  const [events, setEvents] = useState<LlmStreamEvent[]>([]);
  const [activeLlm, setActiveLlm] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<LlmSkippedEvent[]>([]);
  const [text, setText] = useState("");
  const [toolCalls, setToolCalls] = useState<LlmToolCallEvent[]>([]);
  const [message, setMessage] = useState<LlmMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const execute = useCallback(async (data: ExecuteLlm) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("streaming");
    setEvents([]);
    setActiveLlm(null);
    setSkipped([]);
    setText("");
    setToolCalls([]);
    setMessage(null);
    setError(null);

    try {
      await llmConnectionService.executeStream(
        data,
        (event) => {
          setEvents((prev) => [...prev, event]);
          switch (event.event) {
            case "llm_started":
              setActiveLlm(event.data.llm);
              break;
            case "text_delta":
              setText((prev) => prev + event.data.text);
              break;
            case "tool_call":
              setToolCalls((prev) => [...prev, event.data]);
              break;
            case "llm_skipped":
              setSkipped((prev) => [...prev, event.data]);
              break;
            case "message":
              setMessage(event.data.message);
              break;
            case "error":
              setError(new Error(event.data.message));
              setStatus("error");
              break;
            case "done":
              setStatus("done");
              break;
          }
        },
        { signal: controller.signal },
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      const normalized = err instanceof Error ? err : new Error(String(err));
      setError(normalized);
      setStatus("error");
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { status, events, activeLlm, skipped, text, toolCalls, message, error, execute, cancel };
};
