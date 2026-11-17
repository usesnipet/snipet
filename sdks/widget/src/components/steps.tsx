import { Brain, Check, ChevronRight, CircleAlert, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { LLMMessageToolCallPart, LLMToolResultPart } from "@snipet/shared/core";

/** The model's reasoning, collapsed since it's rarely what the user came for. */
export function Thinking({ text }: { text: string }) {
  return (
    <details className="sw-step sw-thinking" part="thinking">
      <summary className="sw-step-summary">
        <Brain className="sw-icon" />
        Thinking
        <ChevronRight className="sw-icon sw-chevron" />
      </summary>
      <div className="sw-step-body sw-thinking-text">{text}</div>
    </details>
  );
}

/** One call as a chip; several in a row collapsed behind a summary like "search ×3, get_order". */
export function ToolCalls({
  calls,
  results,
  running,
}: {
  calls: LLMMessageToolCallPart[];
  results: Map<string, LLMToolResultPart>;
  /** The run is live, so a call without a result is still executing. */
  running: boolean;
}) {
  if (calls.length === 1) return <ToolCall call={calls[0]} result={results.get(calls[0].id)} running={running} />;

  const countOf = new Map<string, number>();
  for (const call of calls) countOf.set(call.name, (countOf.get(call.name) ?? 0) + 1);
  const summary = [...countOf].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(", ");

  return (
    <details className="sw-step sw-tool" part="tool">
      <summary className="sw-step-summary sw-chip" aria-label={`${calls.length} tool calls: ${summary}`}>
        <Wrench className="sw-icon sw-dim" />
        <code className="sw-tool-name" title={summary}>
          {summary}
        </code>
        <StatusIcon results={calls.map((call) => results.get(call.id))} running={running} />
        <ChevronRight className="sw-icon sw-chevron" />
      </summary>
      <div className="sw-step-body">
        {calls.map((call) => (
          <ToolCall key={call.id} call={call} result={results.get(call.id)} running={running} />
        ))}
      </div>
    </details>
  );
}

function ToolCall({
  call,
  result,
  running,
}: {
  call: LLMMessageToolCallPart;
  result: LLMToolResultPart | undefined;
  running: boolean;
}) {
  const args = argumentSummary(call.arguments);
  return (
    <details className="sw-step sw-tool" part="tool">
      <summary className="sw-step-summary sw-chip" aria-label={`${!result && running ? "Using" : "Used"} ${call.name}`}>
        <Wrench className="sw-icon sw-dim" />
        <code className="sw-tool-name">{call.name}</code>
        {args && (
          <span className="sw-tool-args" title={args}>
            {args}
          </span>
        )}
        <StatusIcon results={[result]} running={running} />
        <ChevronRight className="sw-icon sw-chevron" />
      </summary>
      <div className="sw-step-body">
        <p className="sw-dim">Arguments</p>
        <pre className="sw-tool-json">{pretty(call.arguments)}</pre>
        {result && (
          <>
            <p className="sw-dim">{result.isError ? "Error" : "Result"}</p>
            <pre className="sw-tool-json">{pretty(parse(result.content))}</pre>
          </>
        )}
      </div>
    </details>
  );
}

/** The state of one call or a group: the worst outcome wins. A call with no result is live only while the run is. */
function StatusIcon({ results, running }: { results: (LLMToolResultPart | undefined)[]; running: boolean }) {
  const hasOpen = results.some((result) => !result);
  if (hasOpen && running) return <span className="sw-spinner" aria-hidden />;
  if (results.some((result) => result?.isError)) return <X className="sw-icon sw-bad" />;
  if (hasOpen) return <CircleAlert className="sw-icon sw-dim" />;
  return <Check className="sw-icon sw-good" />;
}

/** The call's plain argument values, to tell apart calls of the same tool. */
function argumentSummary(args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  return Object.values(args)
    .filter((value) => ["string", "number", "boolean"].includes(typeof value))
    .join(", ");
}

/** JSON tool results come back as strings; anything else stays as-is. */
function parse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

const pretty = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value, null, 2));

/**
 * What the wait is for, each with messages shown in turn as it drags on;
 * the last one stays.
 */
export const WAIT_MESSAGES = {
  start: ["Thinking", "Reading your message", "Working on it", "Still working on it", "Taking a bit longer than usual"],
  tools: ["Running tools", "Waiting on tool results", "Tools are taking a while"],
  results: ["Reviewing the results", "Putting it together", "Still working on it"],
} as const;

export type WaitPhase = keyof typeof WAIT_MESSAGES;

/** How long each wait message shows before the next. */
const WAIT_MESSAGE_MS = 3000;

/** Before the first token: a spinner and a shimmering status that changes as the wait goes on. Key it by phase to restart. */
export function Waiting({ phase }: { phase: WaitPhase }) {
  const messages = WAIT_MESSAGES[phase];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= messages.length - 1) return;
    const timer = setTimeout(() => setIndex(index + 1), WAIT_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [index, messages.length]);

  return (
    <div className="sw-waiting" part="waiting" aria-live="polite">
      <span className="sw-spinner" aria-hidden />
      <span key={messages[index]} className="sw-shimmer">
        {messages[index]}
      </span>
    </div>
  );
}
