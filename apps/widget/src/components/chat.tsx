import { useLatestRun, useRunStream, useSessionMessages, useStartRun } from "@snipet/client";
import { useEffect, useMemo, useRef, useState } from "react";

import { Composer } from "./composer";
import { Message } from "./message";

import type { AgentMessage } from "@snipet/shared";

// The input shown as a user bubble until the stream echoes it back.
type PendingInput = { sessionId: string | undefined; text: string; runId?: string };

// Same flow as the web playground: history + the followed run's stream, merged by message id.
export function Chat({
  agentId,
  sessionId,
  onSessionStarted,
}: {
  agentId: string;
  sessionId: string | undefined;
  onSessionStarted: (id: string) => void;
}) {
  const history = useSessionMessages(sessionId);
  const latestRun = useLatestRun(sessionId);
  const stream = useRunStream();
  const start = useStartRun();
  const [pending, setPending] = useState<PendingInput | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const { reset, follow } = stream;
  useEffect(() => reset(), [sessionId, reset]);

  // Follow the session's run while it runs: on open and right after sending.
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
    return Array.from(byId.values())
      .sort((a, b) => a.id - b.id)
      .filter((m): m is AgentMessage & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
      .map((m) => ({ id: m.id, role: m.role, runId: m.runId, text: textOf(m) }))
      .filter((m) => m.text);
  }, [history.data, stream.messages, sessionId]);

  const showPending =
    pending !== null &&
    pending.sessionId === sessionId &&
    !messages.some((m) => m.role === "user" && m.runId === pending.runId);
  const running = (stream.status === "streaming" && stream.runId === run?.id) || start.isPending;
  const error = stream.error ?? history.error ?? start.error;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, stream.draft, showPending]);

  const send = (text: string) => {
    setPending({ sessionId, text });
    start.mutate(
      { agentId, sessionId, input: text },
      {
        onSuccess: (started) => {
          setPending({ sessionId: started.sessionId, text, runId: started.id });
          if (!sessionId) onSessionStarted(started.sessionId);
        },
        onError: () => setPending(null),
      },
    );
  };

  const empty = !messages.length && !showPending && !stream.draft;

  return (
    <>
      <div ref={bodyRef} className={empty ? "sw-body sw-empty" : "sw-body sw-messages"} part="body">
        {empty && !error && (history.isLoading ? "Loading…" : "How can I help you?")}
        {messages.map((m) => (
          <Message key={m.id} role={m.role}>
            {m.text}
          </Message>
        ))}
        {showPending && <Message role="user">{pending.text}</Message>}
        {stream.draft && <Message role="assistant">{stream.draft}</Message>}
        {running && !stream.draft && <p className="sw-typing">…</p>}
        {error && (
          <p className="sw-error" role="alert">
            {error.message}
          </p>
        )}
      </div>

      <Composer disabled={running} onSend={send} />
    </>
  );
}

const textOf = (message: AgentMessage) =>
  message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
