import { LoadingFallback } from "@/components/loading-fallback";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useListAgents } from "@/features/agent/hooks";
import { ChatInput } from "@/features/agent-run/components/chat-input";
import { ChatMessages } from "@/features/agent-run/components/chat-messages";
import { SessionSidebar } from "@/features/agent-run/components/session-sidebar";
import {
  useCancelRun, useLatestRun, useRunStream, useSession, useSessionMessages, useStartRun
} from "@/features/agent-run/hooks";
import { sessionPath } from "@/features/agent-run/lib/session-path";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { AgentMessage } from "@/features/agent-run/schemas";

// The input shown as a user bubble until the stream echoes it back.
type PendingInput = { sessionId: string | undefined; text: string; runId?: string };

export const AgentPlaygroundPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const agentsQuery = useListAgents({ searchParams: { take: 100 } });
  const agents = useMemo(() => (agentsQuery.data?.data ?? []).filter((agent) => agent.enabled), [agentsQuery.data]);
  const session = useSession(sessionId);
  const history = useSessionMessages(sessionId);
  const latestRun = useLatestRun(sessionId);
  const stream = useRunStream();
  const start = useStartRun();
  const cancelRun = useCancelRun();

  const [pickedAgentId, setPickedAgentId] = useState<string>();
  const [pending, setPending] = useState<PendingInput | null>(null);

  useDocumentTitle(() => `${session.data?.title || "New chat"} · Playground · Snipet`, [session.data?.title]);

  const { reset, follow } = stream;
  useEffect(() => reset(), [sessionId, reset]);

  // Follow the session's run while it is running: on open, after a reload,
  // and right after sending.
  const run = latestRun.data ?? null;
  useEffect(() => {
    if (!run || run.status !== "running" || stream.runId === run.id || !history.data) return;
    follow(run, history.data.at(-1)?.id ?? 0);
  }, [run, stream.runId, history.data, follow]);

  const messages = useMemo(() => {
    const byId = new Map<number, AgentMessage>();
    for (const message of history.data ?? []) byId.set(message.id, message);
    for (const message of stream.messages) {
      if (message.session_id === sessionId) byId.set(message.id, message);
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
  }, [history.data, stream.messages, sessionId]);

  const showPending =
    pending !== null &&
    pending.sessionId === sessionId &&
    !messages.some((m) => m.role === "user" && m.run_id === pending.runId);

  const agentId = session.data?.agent_id ?? pickedAgentId ?? agents[0]?.id;
  const running = stream.status === "streaming" && stream.runId === run?.id;

  const send = (input: string) => {
    if (!agentId) return;
    setPending({ sessionId, text: input });
    start.mutate(
      { agent_id: agentId, session_id: sessionId, input },
      {
        onSuccess: (started) => {
          setPending({ sessionId: started.session_id, text: input, runId: started.id });
          if (!sessionId) navigate(sessionPath(started.session_id));
        },
        onError: () => setPending(null),
      },
    );
  };

  const stop = () => {
    if (stream.runId) cancelRun.mutate(stream.runId);
  };

  const input = (
    <ChatInput
      agents={agents}
      agentId={agentId}
      onAgentChange={setPickedAgentId}
      agentLocked={!!sessionId}
      running={running}
      sending={start.isPending}
      onSend={send}
      onStop={stop}
    />
  );

  const isEmpty = !sessionId && !showPending;

  return (
    <SidebarProvider>
      <SessionSidebar activeSessionId={sessionId} runningSessionId={running ? sessionId : undefined} />
      <SidebarInset className="h-dvh min-w-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          <SidebarTrigger />
          <h1 className="truncate text-sm font-medium">{session.data?.title || "New chat"}</h1>
        </header>

        {isEmpty ? (
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 pb-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight">How can I help?</h2>
            {agentsQuery.isSuccess && agents.length === 0 ? (
              <p className="text-muted-foreground text-center text-sm">
                There are no enabled agents yet. Create one on the Agents page first.
              </p>
            ) : (
              input
            )}
          </div>
        ) : (
          <>
            {history.isLoading ? (
              <LoadingFallback />
            ) : (
              <ChatMessages
                messages={messages}
                pendingInput={showPending ? pending.text : null}
                draft={stream.draft}
                streaming={running || start.isPending}
                run={run}
                error={stream.error ?? history.error}
              />
            )}
            <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">{input}</div>
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
};
