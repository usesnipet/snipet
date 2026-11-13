import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LLMStreamEventType } from "@snipet/shared/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { syncState } from "../plugin-connection/utils";
import { llmConnectionService } from "./service";

import type {
  CreateLlmConnection,
  ExecuteLLM,
  FindLlmConnectionsParams,
  ListLLMModelsParams,
  LlmConnection,
  Paginated,
  UpdateLlmConnection,
} from "@snipet/shared";
import type {
  LLMManifest,
  LLMMessage,
  LLMModel,
  LLMResponse,
  LLMStreamEvent,
  LLMToolCallRequest,
} from "@snipet/shared/core";
import type { ServiceDeleteOptions, ServiceGetOptions, ServicePostOptions, ServicePutOptions } from "../http";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "llm-connection";

export const listLlmConnectionsQueryKey = () => [BASE_QUERY_KEY] as const;
export const useListLlmConnections = (
  opts?: ServiceGetOptions<Paginated<LlmConnection>, FindLlmConnectionsParams>,
): UseQueryResult<Paginated<LlmConnection>, Error> =>
  useQuery({
    queryKey: [...listLlmConnectionsQueryKey(), opts?.searchParams],
    queryFn: () => llmConnectionService.list(opts),
    // Model sync runs in the background after create; poll until it settles.
    refetchInterval: (query) =>
      query.state.data?.data.some((conn) => syncState(conn).kind === "pending") ? 5000 : false,
  });

export const llmsQueryKey = () => [BASE_QUERY_KEY, "llms"] as const;
export const useLLMs = (opts?: ServiceGetOptions<LLMManifest[]>): UseQueryResult<LLMManifest[], Error> =>
  useQuery({
    queryKey: llmsQueryKey(),
    queryFn: () => llmConnectionService.listLLMs(opts),
  });

export const llmModelsQueryKey = (llmKey: string, searchParams?: ListLLMModelsParams) =>
  [BASE_QUERY_KEY, "llms", llmKey, "models", searchParams] as const;
export const useLLMModels = (
  llmKey: string,
  opts?: ServiceGetOptions<LLMModel[], ListLLMModelsParams>,
): UseQueryResult<LLMModel[], Error> =>
  useQuery({
    queryKey: llmModelsQueryKey(llmKey, opts?.searchParams),
    queryFn: () => llmConnectionService.listLLMModels(llmKey, opts),
    enabled: !!llmKey,
  });

export const llmConnectionModelsQueryKey = (id: string) => [BASE_QUERY_KEY, id, "models"] as const;
export const useLlmConnectionModels = (
  id: string,
  opts?: ServiceGetOptions<LLMModel[]>,
): UseQueryResult<LLMModel[], Error> =>
  useQuery({
    queryKey: llmConnectionModelsQueryKey(id),
    queryFn: () => llmConnectionService.findModels(id, opts),
    enabled: !!id,
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
): UseMutationResult<void, Error, { id: string; data: UpdateLlmConnection }> => {
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

export const useDeleteLlmConnection = (opts?: ServiceDeleteOptions<void>): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => llmConnectionService.delete(id, opts),
    meta: { successMessage: "LLM connection deleted", errorMessage: "Failed to delete LLM connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listLlmConnectionsQueryKey() }),
  });
};

/** Re-syncs a connection's models; everything cached under the connection is refetched. */
export const useSyncLlmConnection = (opts?: ServicePostOptions<void, void>): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => llmConnectionService.sync(id, opts),
    meta: { successMessage: "LLM connection synced", errorMessage: "Failed to sync LLM connection" },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BASE_QUERY_KEY] }),
  });
};

// --- Playground: execute / stream ---

export const useExecuteLlm = (
  opts?: ServicePostOptions<ExecuteLLM, LLMResponse>,
): UseMutationResult<LLMResponse, Error, { data: ExecuteLLM }> =>
  useMutation({
    mutationFn: ({ data }) => llmConnectionService.execute(data, opts),
    meta: { errorMessage: "Failed to execute LLM" },
  });

export type LlmSkippedEvent = Extract<LLMStreamEvent, { event: LLMStreamEventType.LLM_SKIPPED }>["data"];
export type LlmToolCallEvent = LLMToolCallRequest;

export type LlmStreamStatus = "idle" | "streaming" | "done" | "error";

export type UseExecuteLlmStreamResult = {
  status: LlmStreamStatus;
  events: LLMStreamEvent[];
  /** The model currently streaming, e.g. "gpt-4o"; null before the first one starts. */
  activeModel: string | null;
  /** Targets skipped over during failover, in the order they were tried. */
  skipped: LlmSkippedEvent[];
  text: string;
  toolCalls: LlmToolCallEvent[];
  /** The full assistant message, set once the stream ends cleanly. */
  message: LLMMessage | null;
  error: Error | null;
  execute: (data: ExecuteLLM) => Promise<void>;
  cancel: () => void;
};

/**
 * Drives POST /execute/stream: `execute` opens the SSE
 * connection and accumulates text_delta/tool_call events as they arrive,
 * `cancel` aborts an in-flight run. Not react-query — there is no cached
 * value to key on, only a live event stream.
 */
export const useExecuteLlmStream = (): UseExecuteLlmStreamResult => {
  const [status, setStatus] = useState<LlmStreamStatus>("idle");
  const [events, setEvents] = useState<LLMStreamEvent[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<LlmSkippedEvent[]>([]);
  const [text, setText] = useState("");
  const [toolCalls, setToolCalls] = useState<LlmToolCallEvent[]>([]);
  const [message, setMessage] = useState<LLMMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const execute = useCallback(async (data: ExecuteLLM) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("streaming");
    setEvents([]);
    setActiveModel(null);
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
            case LLMStreamEventType.LLM_STARTED:
              setActiveModel(event.data.model);
              break;
            case LLMStreamEventType.TEXT_DELTA:
              setText((prev) => prev + event.data.text);
              break;
            case LLMStreamEventType.TOOL_CALL:
              setToolCalls((prev) => [...prev, event.data.call]);
              break;
            case LLMStreamEventType.LLM_SKIPPED:
              setSkipped((prev) => [...prev, event.data]);
              break;
            case LLMStreamEventType.MESSAGE:
              setMessage(event.data.message);
              break;
            case LLMStreamEventType.ERROR:
              setError(new Error(event.data.message));
              setStatus("error");
              break;
            case LLMStreamEventType.DONE:
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

  return { status, events, activeModel, skipped, text, toolCalls, message, error, execute, cancel };
};
