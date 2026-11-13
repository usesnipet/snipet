import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatInput } from "@/features/agent-run/components/chat-input";
import { ChatMessages } from "@/features/agent-run/components/chat-messages";
import { SessionSidebar } from "@/features/agent-run/components/session-sidebar";
import { sessionPath } from "@/features/agent-run/lib/session-path";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  useCancelRun,
  useLatestRun,
  useListAvailableAgents,
  useRunStream,
  useSession,
  useSessionMessages,
  useStartRun,
} from "@snipet/client";
import { LLMRole } from "@snipet/shared/core";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import type { AgentMessage } from "@snipet/shared";

/** The input shown as a user bubble until the stream echoes it back. */
type PendingInput = { sessionId: string | undefined; text: string; runId?: string };

export const ChatPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const agentsQuery = useListAvailableAgents();
  const agents = agentsQuery.data ?? [];
  const session = useSession(sessionId);
  const history = useSessionMessages(sessionId);
  const latestRun = useLatestRun(sessionId);
  const stream = useRunStream();
  const start = useStartRun();
  const cancelRun = useCancelRun();

  // Remembers the filter it was picked under: choosing another filter starts over from that agent.
  const [picked, setPicked] = useState<{ agentId: string; agentParam: string | null }>();
  const [pending, setPending] = useState<PendingInput | null>(null);

  useDocumentTitle(() => `${session.data?.title || "New chat"} · Snipet`, [session.data?.title]);

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
      if (message.sessionId === sessionId) byId.set(message.id, message);
    }
    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
  }, [history.data, stream.messages, sessionId]);

  const showPending =
    pending !== null &&
    pending.sessionId === sessionId &&
    !messages.some((m) => m.role === LLMRole.USER && m.runId === pending.runId);

  // Only an agent the user can chat with: a link can name a disabled or deleted one.
  const agentParam = searchParams.get("agent");
  const linkedAgentId = agents.find((agent) => agent.id === agentParam)?.id;
  const pickedAgentId = picked?.agentParam === agentParam ? picked.agentId : undefined;
  const agentId = session.data?.agentId ?? pickedAgentId ?? linkedAgentId ?? agents[0]?.id;
  const running = stream.status === "streaming" && stream.runId === run?.id;

  const send = (input: string) => {
    if (!agentId) return;
    setPending({ sessionId, text: input });
    start.mutate(
      { agentId, sessionId, input },
      {
        onSuccess: (started) => {
          setPending({ sessionId: started.sessionId, text: input, runId: started.id });
          // A filter follows the agent actually used, so the new chat shows up in the list.
          if (!sessionId) navigate(sessionPath(started.sessionId, linkedAgentId && agentId));
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
      key={sessionId}
      agents={agents}
      agentId={agentId}
      onAgentChange={(pickedId) => setPicked({ agentId: pickedId, agentParam })}
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
                There are no enabled agents yet. An admin can create one on the Agents page.
              </p>
            ) : (
              input
            )}
          </div>
        ) : (
          <>
            {history.isLoading ? (
              <ChatHistorySkeleton />
            ) : (
              <ChatMessages
                messages={messages}
                agent={agents.find((agent) => agent.id === agentId)}
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

/**
 * A chat's shape while its history loads: a user bubble on the right, then an
 * agent reply with its avatar and a few lines, on the same column as `ChatMessages`.
 */
function ChatHistorySkeleton() {
  return (
    <div role="status" className="flex-1 overflow-hidden">
      <span className="sr-only">Loading chat</span>
      <div aria-hidden className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        {[0, 1].map((turn) => (
          <div key={turn} className="flex flex-col gap-6">
            <div className="flex justify-end">
              <Skeleton className="h-11 w-1/2 rounded-3xl" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-lg" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
