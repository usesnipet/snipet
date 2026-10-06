import { useLatestRun, useListSessions, useRunStream, useSessionMessages, useStartRun } from "@snipet/client";
import { History, MessageCircle, SendHorizontal, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useWidgetConfig, widgetStore } from "./config";

import type { AgentMessage } from "@snipet/shared";

type View = "chat" | "sessions";

// `part` attributes let the host page style pieces with snipet-widget::part(name).
export function Widget() {
  const config = useWidgetConfig();
  const { open } = config;
  const setOpen = (value: boolean) => widgetStore.set({ open: value });

  const [view, setView] = useState<View>("chat");
  const [sessionId, setSessionId] = useState<string>();
  const ready = !!config.token && !!config.agentId;

  return (
    <>
      {/* Custom CSS comes after the base <style>, so it wins at equal specificity. */}
      {config.cssUrl && <link rel="stylesheet" href={config.cssUrl} />}
      {config.css && <style>{config.css}</style>}

      {config.enabled && (
        <div className="sw-root" part="root">
          {open && (
            <div className="sw-panel" part="panel">
              <header className="sw-header" part="header">
                <span className="sw-title">{view === "sessions" ? "Chats" : "Chat"}</span>
                <div className="sw-actions">
                  {ready && (
                    <>
                      <button
                        type="button"
                        onClick={() => setView(view === "sessions" ? "chat" : "sessions")}
                        aria-label="Chat history"
                        aria-pressed={view === "sessions"}
                        className="sw-icon-button"
                      >
                        <History className="sw-icon" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionId(undefined);
                          setView("chat");
                        }}
                        aria-label="New chat"
                        className="sw-icon-button"
                      >
                        <SquarePen className="sw-icon" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close chat"
                    className="sw-icon-button"
                  >
                    <X className="sw-icon" />
                  </button>
                </div>
              </header>

              {!config.token ? (
                <div className="sw-body sw-empty" part="body">
                  Sign in to chat.
                </div>
              ) : !config.agentId ? (
                <div className="sw-body sw-empty" part="body">
                  This chat isn't set up yet.
                </div>
              ) : view === "sessions" ? (
                <Sessions
                  activeId={sessionId}
                  onPick={(id) => {
                    setSessionId(id);
                    setView("chat");
                  }}
                />
              ) : (
                <Chat agentId={config.agentId} sessionId={sessionId} onSessionStarted={setSessionId} />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close chat" : "Open chat"}
            aria-expanded={open}
            className="sw-launcher"
            part="launcher"
          >
            {open ? <X className="sw-icon" /> : <MessageCircle className="sw-icon" />}
          </button>
        </div>
      )}
    </>
  );
}

function Sessions({ activeId, onPick }: { activeId?: string; onPick: (id: string) => void }) {
  const sessions = useListSessions();

  if (sessions.isLoading) return <div className="sw-body sw-empty">Loading…</div>;
  if (sessions.error) return <div className="sw-body sw-empty">{sessions.error.message}</div>;
  if (!sessions.data?.data.length) return <div className="sw-body sw-empty">No chats yet.</div>;

  return (
    <ul className="sw-body sw-sessions" part="sessions">
      {sessions.data.data.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            onClick={() => onPick(session.id)}
            aria-current={session.id === activeId}
            className="sw-session"
            part="session"
          >
            {session.title || "New chat"}
          </button>
        </li>
      ))}
    </ul>
  );
}

// The input shown as a user bubble until the stream echoes it back.
type PendingInput = { sessionId: string | undefined; text: string; runId?: string };

// Same flow as the web playground: history + the followed run's stream, merged by message id.
function Chat({
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
  const [input, setInput] = useState("");
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
      .filter((m) => m.role === "user" || m.role === "assistant")
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

  const send = () => {
    const text = input.trim();
    if (!text || running) return;
    setInput("");
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
          <p key={m.id} className={`sw-message sw-${m.role}`} part={`message ${m.role}`}>
            {m.text}
          </p>
        ))}
        {showPending && (
          <p className="sw-message sw-user" part="message user">
            {pending.text}
          </p>
        )}
        {stream.draft && (
          <p className="sw-message sw-assistant" part="message assistant">
            {stream.draft}
          </p>
        )}
        {running && !stream.draft && <p className="sw-typing">…</p>}
        {error && (
          <p className="sw-error" role="alert">
            {error.message}
          </p>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="sw-composer"
        part="composer"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message..."
          className="sw-input"
          part="input"
        />
        <button type="submit" disabled={running || !input.trim()} aria-label="Send" className="sw-send" part="send">
          <SendHorizontal className="sw-icon" />
        </button>
      </form>
    </>
  );
}

const textOf = (message: AgentMessage) =>
  message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
