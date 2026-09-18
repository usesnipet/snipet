import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { llmConnectionService } from "./service";

import type {
  CreateLlmConnection,
  ExecuteLlm,
  ExecuteLlmResponse,
  ListLlmConnectionsSearchParams,
  ListLlmProvider,
  ListProviderModels,
  ListProviderModelsSearchParams,
  LlmMessage,
  LlmSkippedEvent,
  LlmStreamEvent,
  LlmToolCallEvent,
  PaginatedLlmConnection,
  UpdateLlmConnection,
  LlmConnection,
} from "./schemas";
import type {
  ServiceDeleteOptions,
  ServiceGetOptions,
  ServicePostOptions,
  ServicePutOptions,
} from "@/lib/services";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "llm-connection";

export const listLlmConnectionsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListLlmConnections = (
  opts?: ServiceGetOptions<PaginatedLlmConnection, ListLlmConnectionsSearchParams>,
): UseQueryResult<PaginatedLlmConnection, Error> =>
  useQuery({
    queryKey: [...listLlmConnectionsQueryKey(), opts?.searchParams],
    queryFn: () => llmConnectionService.list(opts),
  });

export const llmProvidersQueryKey = () =>
  [BASE_QUERY_KEY, "providers"] as const;
export const useLlmProviders = (
  opts?: ServiceGetOptions<ListLlmProvider>,
): UseQueryResult<ListLlmProvider, Error> =>
  useQuery({
    queryKey: llmProvidersQueryKey(),
    queryFn: () => llmConnectionService.listProviders(opts),
  });

export const providerModelsQueryKey = (providerKey: string, searchParams?: ListProviderModelsSearchParams) =>
  [BASE_QUERY_KEY, "providers", providerKey, "models", searchParams] as const;
export const useProviderModels = (
  providerKey: string,
  opts?: ServiceGetOptions<ListProviderModels, ListProviderModelsSearchParams>,
): UseQueryResult<ListProviderModels, Error> =>
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
): UseMutationResult<LlmConnection, Error, { data: CreateLlmConnection }> =>
  useMutation({
    mutationFn: ({ data }) => llmConnectionService.create(data, opts),
    onSuccess: () => {
      toast({ title: "LLM connection created" });
      queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to create LLM connection", variant: "destructive" });
    },
  });

export const useUpdateLlmConnection = (
  opts?: ServicePutOptions<UpdateLlmConnection, void>,
): UseMutationResult<void, Error, { id: string, data: UpdateLlmConnection }> =>
  useMutation({
    mutationFn: ({ data, id }) => llmConnectionService.update(id, data, opts),
    onSuccess: (_, { id }) => {
      toast({ title: "LLM connection updated" });
      queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: llmConnectionQueryKey(id) });
    },
    onError: () => {
      toast({ title: "Failed to update LLM connection", variant: "destructive" });
    },
  });

export const useDeleteLlmConnection = (
  opts?: ServiceDeleteOptions<void>,
): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => llmConnectionService.delete(id, opts),
    onSuccess: () => {
      toast({ title: "LLM connection deleted" });
      queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() });
    },
    onError: () => {
      toast({ title: "Failed to delete LLM connection", variant: "destructive" });
    },
  });

// --- Playground: execute / stream ---

export const useExecuteLlm = (
  opts?: ServicePostOptions<ExecuteLlm, ExecuteLlmResponse>,
): UseMutationResult<ExecuteLlmResponse, Error, { data: ExecuteLlm }> =>
  useMutation({
    mutationFn: ({ data }) => llmConnectionService.execute(data, opts),
    onError: () => {
      toast({ title: "Failed to execute LLM", variant: "destructive" });
    },
  });

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
      toast({ title: "Failed to execute LLM", variant: "destructive" });
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { status, events, activeLlm, skipped, text, toolCalls, message, error, execute, cancel };
};
