import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";

import { agentRunService } from "./service";

import type { AgentMessage, AgentRun, AgentSession, PaginatedAgentSession, StartRun } from "./schemas";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "agent-session";

// Only the newest sessions and messages are loaded.
const SESSIONS_TAKE = 100;
const MESSAGES_TAKE = 100;

export const listSessionsQueryKey = () => [BASE_QUERY_KEY, "list"] as const;
export const useListSessions = (): UseQueryResult<PaginatedAgentSession, Error> =>
  useQuery({
    queryKey: listSessionsQueryKey(),
    queryFn: () => agentRunService.listSessions({ searchParams: { take: SESSIONS_TAKE } }),
  });

export const sessionQueryKey = (id: string) => [BASE_QUERY_KEY, id] as const;
export const useSession = (id: string | undefined): UseQueryResult<AgentSession, Error> =>
  useQuery({
    queryKey: sessionQueryKey(id ?? ""),
    queryFn: () => agentRunService.findSession(id!),
    enabled: !!id,
  });

// useSessionMessages returns a session's latest messages, oldest first.
export const sessionMessagesQueryKey = (id: string) => [BASE_QUERY_KEY, id, "messages"] as const;
export const useSessionMessages = (id: string | undefined): UseQueryResult<AgentMessage[], Error> =>
  useQuery({
    queryKey: sessionMessagesQueryKey(id ?? ""),
    queryFn: async () => {
      const page = await agentRunService.listMessages(id!, { searchParams: { take: MESSAGES_TAKE } });
      return page.data.toReversed();
    },
    enabled: !!id,
  });

// useLatestRun returns the session's newest run, or null when it has none.
export const latestRunQueryKey = (sessionId: string) => [BASE_QUERY_KEY, sessionId, "latest-run"] as const;
export const useLatestRun = (sessionId: string | undefined): UseQueryResult<AgentRun | null, Error> =>
  useQuery({
    queryKey: latestRunQueryKey(sessionId ?? ""),
    queryFn: async () => {
      const page = await agentRunService.listRuns({ searchParams: { session_id: sessionId!, take: 1 } });
      return page.data[0] ?? null;
    },
    enabled: !!sessionId,
  });

// useStartRun starts a run and seeds the session's latest run with it, which
// is what useRunStream's caller follows.
export const useStartRun = (): UseMutationResult<AgentRun, Error, StartRun> =>
  useMutation({
    mutationFn: (data: StartRun) => agentRunService.start(data),
    onSuccess: (run) => {
      queryClient.setQueryData(latestRunQueryKey(run.session_id), run);
      queryClient.invalidateQueries({ queryKey: listSessionsQueryKey() });
    },
    onError: (error) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

export const useCancelRun = (): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => agentRunService.cancel(id),
    onError: () => {
      toast({ title: "Failed to stop the run", variant: "destructive" });
    },
  });

export const useDeleteSession = (): UseMutationResult<void, Error, string> =>
  useMutation({
    mutationFn: (id: string) => agentRunService.deleteSession(id),
    onSuccess: () => {
      toast({ title: "Chat deleted" });
      queryClient.invalidateQueries({ queryKey: listSessionsQueryKey() });
    },
    onError: (error) => {
      toast({ title: "Failed to delete chat", description: error.message, variant: "destructive" });
    },
  });

type RunStreamStatus = "idle" | "streaming" | "error";

type UseRunStreamResult = {
  status: RunStreamStatus;
  runId: string | null;
  /** Messages received over the stream, in id order. */
  messages: AgentMessage[];
  /** Assistant text streamed since the last saved message. */
  draft: string;
  error: Error | null;
  follow: (run: AgentRun, lastId: number) => void;
  reset: () => void;
};

// useRunStream follows one run's SSE events. On run_finished it refreshes the
// session's cached messages and latest run, so the stream's messages can be
// merged with the history by id.
export const useRunStream = (): UseRunStreamResult => {
  const [status, setStatus] = useState<RunStreamStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setRunId(null);
    setMessages([]);
    setDraft("");
    setError(null);
  }, []);

  const follow = useCallback((run: AgentRun, lastId: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("streaming");
    setRunId(run.id);
    setDraft("");
    setError(null);

    const finish = (finished: AgentRun) => {
      queryClient.setQueryData(latestRunQueryKey(finished.session_id), finished);
      queryClient.invalidateQueries({ queryKey: sessionMessagesQueryKey(finished.session_id) });
      queryClient.invalidateQueries({ queryKey: listSessionsQueryKey() });
    };

    agentRunService
      .events(
        run.id,
        lastId,
        (event) => {
          switch (event.event) {
            case "text_delta":
              setDraft((prev) => prev + event.data.text);
              break;
            case "message": {
              const message = event.data;
              setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
              if (message.role === "assistant") setDraft("");
              break;
            }
            case "run_finished":
              finish(event.data);
              break;
            case "error":
              setError(new Error(event.data.message));
              break;
          }
        },
        { signal: controller.signal },
      )
      .then(() => {
        if (controller.signal.aborted) return;
        setDraft("");
        setStatus((prev) => (prev === "streaming" ? "idle" : prev));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { status, runId, messages, draft, error, follow, reset };
};
