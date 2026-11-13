import { useLatestRun, useRunStream, useSessionMessages, useStartRun } from "@snipet/client";
import { useEffect, useMemo, useRef, useState } from "react";

import { emit } from "../events";

import { LLMMessagePartType, LLMRole } from "@snipet/shared/core";

import { Composer } from "./composer";
import { Message } from "./message";
import { Thinking, ToolCalls, Waiting } from "./steps";

import type { WaitPhase } from "./steps";
import type { AgentMessage, AgentRun } from "@snipet/shared";
import type { LLMMessageToolCallPart, LLMToolResultPart } from "@snipet/shared/core";

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
  const emitted = useRef(new Set<number>());

  const { reset, follow } = stream;
  useEffect(() => reset(), [sessionId, reset]);

  // Follow the session's run while it runs: on open and right after sending.
  const run = latestRun.data ?? null;
  useEffect(() => {
    if (!run || run.status !== "running" || stream.runId === run.id || !history.data) return;
    follow(run, history.data.at(-1)?.id ?? 0);
  }, [run, stream.runId, history.data, follow]);

  // Stream messages are the live ones (history is already known): each reaches the host once.
  useEffect(() => {
    for (const message of stream.messages) {
      if (emitted.current.has(message.id) || (message.role !== "user" && message.role !== "assistant")) continue;
      emitted.current.add(message.id);
      const text = textOf(message);
      if (text) emit("message", { role: message.role, text, sessionId: message.sessionId });
    }
  }, [stream.messages]);

  // Request errors are emitted by the QueryClient's caches (see main.tsx).
  useEffect(() => {
    if (stream.error) emit("error", { message: stream.error.message });
  }, [stream.error]);

  const messages = useMemo(() => {
    const byId = new Map<number, AgentMessage>();
    for (const message of history.data ?? []) byId.set(message.id, message);
    for (const message of stream.messages) {
      if (message.sessionId === sessionId) byId.set(message.id, message);
    }
    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
  }, [history.data, stream.messages, sessionId]);
  const blocks = useMemo(() => toBlocks(messages), [messages]);

  // Tool results render inside their call, keyed by toolCallId.
  const results = useMemo(() => {
    const byCallId = new Map<string, LLMToolResultPart>();
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type === LLMMessagePartType.TOOL_RESULT) byCallId.set(part.toolCallId, part);
      }
    }
    return byCallId;
  }, [messages]);

  const showPending =
    pending !== null &&
    pending.sessionId === sessionId &&
    !messages.some((m) => m.role === "user" && m.runId === pending.runId);
  const running = (stream.status === "streaming" && stream.runId === run?.id) || start.isPending;
  const error = stream.error ?? history.error ?? start.error;
  const last = messages.at(-1);
  const waiting =
    running && !stream.draft && (showPending || last?.role !== LLMRole.ASSISTANT || hasOpenCalls(last, results));
  const notice = !running && run ? RUN_NOTICES[run.status] : undefined;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, stream.draft, showPending, waiting]);

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

  const empty = !blocks.length && !showPending && !stream.draft;

  return (
    <>
      <div ref={bodyRef} className={empty ? "sw-body sw-empty" : "sw-body sw-messages"} part="body">
        {empty && !error && (history.isLoading ? "Loading…" : "How can I help you?")}
        {blocks.map((block) => {
          if (block.kind === "thinking") return <Thinking key={block.key} text={block.text} />;
          if (block.kind === "tools")
            return <ToolCalls key={block.key} calls={block.calls} results={results} running={running} />;
          return (
            <Message key={block.key} role={block.kind}>
              {block.text}
            </Message>
          );
        })}
        {showPending && <Message role="user">{pending.text}</Message>}
        {stream.draft && <Message role="assistant">{stream.draft}</Message>}
        {waiting && <Waiting key={waitPhase(last, results)} phase={waitPhase(last, results)} />}
        {notice && (
          <p className={run?.status === "cancelled" ? "sw-notice" : "sw-error"} role="status">
            {notice}
            {run?.error ? `: ${run.error}` : "."}
          </p>
        )}
        {error && (
          <p className="sw-error" role="alert">
            {error.message}
          </p>
        )}
      </div>

      <Composer key={sessionId} disabled={running} onSend={send} />
    </>
  );
}

const RUN_NOTICES: Partial<Record<AgentRun["status"], string>> = {
  failed: "The agent couldn't finish",
  cancelled: "Stopped",
  max_turns: "The agent hit its turn limit before finishing",
};

/** A stretch of the conversation as shown on screen. */
type Block =
  | { kind: "user" | "assistant" | "thinking"; key: string; text: string }
  | { kind: "tools"; key: string; calls: LLMMessageToolCallPart[] };

/**
 * Turns messages into blocks. Tool calls in a row join one block even across
 * messages: each turn of a long run is its own message, so split by message
 * they'd read as a wall of chips.
 */
function toBlocks(messages: AgentMessage[]): Block[] {
  const blocks: Block[] = [];
  for (const message of messages) {
    if (message.role === LLMRole.USER) {
      const text = textOf(message);
      if (text) blocks.push({ kind: "user", key: String(message.id), text });
    } else if (message.role === LLMRole.ASSISTANT) {
      message.parts.forEach((part, index) => {
        const key = `${message.id}-${index}`;
        const last = blocks.at(-1);
        if (part.type === LLMMessagePartType.TOOL_CALL) {
          if (last?.kind === "tools") last.calls.push(part);
          else blocks.push({ kind: "tools", key, calls: [part] });
        } else if (part.type === LLMMessagePartType.THINKING && part.text.trim()) {
          blocks.push({ kind: "thinking", key, text: part.text.trim() });
        } else if (part.type === LLMMessagePartType.TEXT && part.text.trim()) {
          blocks.push({ kind: "assistant", key, text: part.text.trim() });
        }
      });
    }
  }
  return blocks;
}

function hasOpenCalls(message: AgentMessage, results: Map<string, LLMToolResultPart>) {
  return message.parts.some((part) => part.type === LLMMessagePartType.TOOL_CALL && !results.has(part.id));
}

function waitPhase(last: AgentMessage | undefined, results: Map<string, LLMToolResultPart>): WaitPhase {
  if (last?.role === LLMRole.TOOL) return "results";
  if (last?.role === LLMRole.ASSISTANT && hasOpenCalls(last, results)) return "tools";
  return "start";
}

const textOf = (message: AgentMessage) =>
  message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
