import { CopyIcon } from "@/components/swap-icon";
import { JsonViewer } from "@/components/json-viewer";
import { SnipetLoader } from "@/components/snipet-loader";
import { Button } from "@/components/ui/button";
import { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor } from "@/components/ui/chat-container";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader, TextShimmerLoader } from "@/components/ui/loader";
import { Markdown } from "@/components/ui/markdown";
import { MessageAction, MessageActions } from "@/components/ui/message";
import { ScrollButton } from "@/components/ui/scroll-button";
import { AgentAvatar } from "@/features/agent/components/agent-avatar";
import { enterUp, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Brain, Check, ChevronRight, CircleAlert, Wrench, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { LLMMessagePartType, LLMRole } from "@snipet/shared/core";

import type { AgentMessage, AgentRun, AvailableAgent } from "@snipet/shared";
import type { LLMMessagePart } from "@snipet/shared/core";

type ToolCallPart = Extract<LLMMessagePart, { type: LLMMessagePartType.TOOL_CALL }>;
type ToolResultPart = Extract<LLMMessagePart, { type: LLMMessagePartType.TOOL_RESULT }>;

type Props = {
  /** The agent replying, when the user can see it. */
  agent: AvailableAgent | undefined;
  messages: AgentMessage[];
  /** Input sent but not yet echoed back by the stream. */
  pendingInput: string | null;
  draft: string;
  streaming: boolean;
  /** The session's latest run, for its failure notice. */
  run: AgentRun | null;
  error: Error | null;
};

const RUN_NOTICES: Partial<Record<AgentRun["status"], string>> = {
  failed: "The agent couldn't finish",
  cancelled: "Stopped",
  max_turns: "The agent hit its turn limit before finishing",
};

/** Markdown element styles, since no typography plugin is installed. */
const MARKDOWN_CLASS = cn(
  "space-y-2 leading-7 break-words",
  "[&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:space-y-1 [&_ul,&_ol]:pl-6",
  "[&_a]:text-link [&_a]:underline [&_strong]:font-semibold",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:pl-4",
  "[&_table]:w-full [&_td,&_th]:border [&_td,&_th]:px-2 [&_td,&_th]:py-1 [&_th]:text-left [&_hr]:my-4",
);

const textOf = (parts: LLMMessagePart[]) =>
  parts
    .filter(
      (part): part is Extract<LLMMessagePart, { type: LLMMessagePartType.TEXT }> =>
        part.type === LLMMessagePartType.TEXT,
    )
    .map((part) => part.text)
    .join("\n");

/** A stretch of the conversation as shown on screen. */
type Block =
  | { kind: "user"; key: string; text: string }
  | { kind: "assistant"; key: string; messageId: number; parts: LLMMessagePart[] }
  | { kind: "tools"; key: string; calls: ToolCallPart[] };

/**
 * Turns messages into blocks. Tool calls in a row join one block even across
 * messages: each turn of a long run is its own message, so split by message
 * they'd read as a wall of unevenly spaced chips.
 */
function toBlocks(messages: AgentMessage[]): Block[] {
  const blocks: Block[] = [];
  for (const message of messages) {
    if (message.role === LLMRole.USER) {
      blocks.push({ kind: "user", key: String(message.id), text: textOf(message.parts) });
    } else if (message.role === LLMRole.ASSISTANT) {
      message.parts.forEach((part, index) => {
        const last = blocks.at(-1);
        if (part.type === LLMMessagePartType.TOOL_CALL) {
          if (last?.kind === "tools") last.calls.push(part);
          else blocks.push({ kind: "tools", key: part.id, calls: [part] });
        } else if ((part.type === LLMMessagePartType.TEXT || part.type === LLMMessagePartType.THINKING) && part.text) {
          if (last?.kind === "assistant" && last.messageId === message.id) last.parts.push(part);
          else blocks.push({ kind: "assistant", key: `${message.id}-${index}`, messageId: message.id, parts: [part] });
        }
      });
    }
  }
  return blocks;
}

export function ChatMessages({ agent, messages, pendingInput, draft, streaming, run, error }: Props) {
  // Tool results are rendered inside their call, keyed by toolCallId.
  const results = new Map<string, ToolResultPart>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === LLMMessagePartType.TOOL_RESULT) results.set(part.toolCallId, part);
    }
  }

  const blocks = toBlocks(messages);
  const last = messages.at(-1);
  const waiting =
    streaming && !draft && (pendingInput !== null || last?.role !== LLMRole.ASSISTANT || hasOpenCalls(last, results));
  const notice = !streaming && run ? RUN_NOTICES[run.status] : undefined;
  const replyStartsAtEnd = pendingInput !== null || blocks.length === 0 || blocks.at(-1)?.kind === "user";

  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="mx-auto max-w-3xl gap-6 px-4 py-8">
        {/*
          The history on screen at mount stays still; only what arrives later enters.
          Echoed user messages and finished replies don't animate: they replace the
          pending bubble and the streamed draft in place, so animating them would flash.
        */}
        <AnimatePresence initial={false}>
          {blocks.map((block, index) => {
            if (block.kind === "user") return <UserBubble key={block.key} text={block.text} />;
            const startsReply = index === 0 || blocks[index - 1].kind === "user";
            const Wrapper = block.kind === "tools" ? motion.div : "div";
            return (
              <Wrapper key={block.key} className="flex flex-col gap-2" {...(block.kind === "tools" && enterUp)}>
                {startsReply && <AgentName agent={agent} />}
                {block.kind === "assistant" ? (
                  <AssistantText parts={block.parts} />
                ) : (
                  <ToolCalls calls={block.calls} results={results} running={streaming} />
                )}
              </Wrapper>
            );
          })}
          {pendingInput !== null && (
            <motion.div key="pending" {...enterUp}>
              <UserBubble text={pendingInput} />
            </motion.div>
          )}
          {(draft || waiting) && (
            <motion.div key="reply" className="flex flex-col gap-2" {...enterUp}>
              {replyStartsAtEnd && <AgentName agent={agent} />}
              {draft && <Markdown className={MARKDOWN_CLASS}>{draft}</Markdown>}
              {waiting && <WaitingIndicator key={waitPhase(last, results)} phase={waitPhase(last, results)} />}
            </motion.div>
          )}
          {notice && (
            <motion.div key="notice" {...enterUp}>
              <Notice muted={run?.status === "cancelled"}>
                {notice}
                {run?.error ? `: ${run.error}` : "."}
              </Notice>
            </motion.div>
          )}
          {error && (
            <motion.div key="error" {...enterUp}>
              <Notice>{error.message}</Notice>
            </motion.div>
          )}
        </AnimatePresence>
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  );
}

function hasOpenCalls(message: AgentMessage, results: Map<string, ToolResultPart>) {
  return message.parts.some((part) => part.type === LLMMessagePartType.TOOL_CALL && !results.has(part.id));
}

/**
 * What the wait is for, each with messages shown in turn as it drags on;
 * the last one stays.
 */
const WAIT_MESSAGES = {
  start: ["Thinking", "Reading your message", "Working on it", "Still working on it", "Taking a bit longer than usual"],
  tools: ["Running tools", "Waiting on tool results", "Tools are taking a while"],
  results: ["Reviewing the results", "Putting it together", "Still working on it"],
} as const;

/** How long each wait message shows before the next. */
const WAIT_MESSAGE_MS = 3000;

function waitPhase(last: AgentMessage | undefined, results: Map<string, ToolResultPart>): keyof typeof WAIT_MESSAGES {
  if (last?.role === LLMRole.TOOL) return "results";
  if (last?.role === LLMRole.ASSISTANT && hasOpenCalls(last, results)) return "tools";
  return "start";
}

/** Before the first token: the animated logo and a shimmering status that changes as the wait goes on. */
function WaitingIndicator({ phase }: { phase: keyof typeof WAIT_MESSAGES }) {
  const messages = WAIT_MESSAGES[phase];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= messages.length - 1) return;
    const timer = setTimeout(() => setIndex(index + 1), WAIT_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [index, messages.length]);

  return (
    <div className="flex h-7 items-center gap-2.5" aria-live="polite">
      <SnipetLoader size="sm" className="flex-none delay-0" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={messages[index]}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: transitions.fast }}
          transition={transitions.base}
        >
          <TextShimmerLoader text={messages[index]} size="md" className="motion-reduce:animate-none" />
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** Who is replying; nothing for an agent the user can no longer see, like a disabled one. */
function AgentName({ agent }: { agent: AvailableAgent | undefined }) {
  if (!agent) return null;
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <AgentAvatar avatar={agent.avatar} name={agent.name} className="size-6" />
      {agent.name}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <Markdown className={cn("bg-muted max-w-[80%] rounded-3xl px-5 py-2.5", MARKDOWN_CLASS)}>{text}</Markdown>
    </div>
  );
}

function AssistantText({ parts }: { parts: LLMMessagePart[] }) {
  const text = textOf(parts);
  return (
    <div className="group flex flex-col gap-2">
      {parts.map((part, i) => {
        if (part.type === LLMMessagePartType.TEXT) {
          return (
            <Markdown key={i} className={MARKDOWN_CLASS}>
              {part.text}
            </Markdown>
          );
        }
        if (part.type === LLMMessagePartType.THINKING) return <Thinking key={i} text={part.text} />;
        return null;
      })}
      {text && (
        <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton text={text} />
        </MessageActions>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <MessageAction tooltip={copied ? "Copied" : "Copy"}>
      <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy message">
        <CopyIcon copied={copied} />
      </Button>
    </MessageAction>
  );
}

/** The model's reasoning, collapsed since it's rarely what the user came for. */
function Thinking({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0">
        <Brain />
        Thinking
        <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground mt-2 border-l pl-4 text-sm whitespace-pre-wrap">
        {text}
      </CollapsibleContent>
    </Collapsible>
  );
}

const TOOL_CHIP_CLASS =
  "bg-background hover:bg-accent flex w-fit max-w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0";

/** The state of one call or a group: the worst outcome wins. A call with no result is live only while the run is. */
function ToolStatusIcon({ results, running }: { results: (ToolResultPart | undefined)[]; running: boolean }) {
  const hasOpen = results.some((result) => !result);
  if (hasOpen && running) return <Loader variant="circular" size="sm" />;
  if (results.some((result) => result?.isError)) return <X className="text-destructive" />;
  if (hasOpen) return <CircleAlert className="text-muted-foreground" />;
  return <Check className="text-emerald-600 dark:text-emerald-400" />;
}

/** The call's plain argument values, to tell apart calls of the same tool. */
function summarizeArguments(args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  return Object.values(args)
    .filter((value) => ["string", "number", "boolean"].includes(typeof value))
    .join(", ");
}

/** "issue_read ×4, get_me": what a group of calls did. */
function summarizeCalls(calls: ToolCallPart[]): string {
  const countOf = new Map<string, number>();
  for (const call of calls) countOf.set(call.name, (countOf.get(call.name) ?? 0) + 1);
  return [...countOf].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(", ");
}

type ToolCallsProps = {
  calls: ToolCallPart[];
  results: Map<string, ToolResultPart>;
  /** The run is live, so a call without a result is still executing. */
  running: boolean;
};

/** One call as a chip; several in a row collapsed behind a summary. */
function ToolCalls({ calls, results, running }: ToolCallsProps) {
  const [open, setOpen] = useState(false);

  if (calls.length === 1) {
    return <ToolCall call={calls[0]} result={results.get(calls[0].id)} running={running} />;
  }

  const summary = summarizeCalls(calls);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger aria-label={`${calls.length} tool calls: ${summary}`} className={TOOL_CHIP_CLASS}>
        <Wrench className="text-muted-foreground" />
        <code className="min-w-0 truncate font-mono text-[0.8125rem]" title={summary}>
          {summary}
        </code>
        <ToolStatusIcon results={calls.map((call) => results.get(call.id))} running={running} />
        <ChevronRight className={cn("text-muted-foreground transition-transform", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 border-l pl-4">
        {calls.map((call) => (
          <ToolCall key={call.id} call={call} result={results.get(call.id)} running={running} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

type ToolCallProps = {
  call: ToolCallPart;
  result: ToolResultPart | undefined;
  running: boolean;
};

function ToolCall({ call, result, running }: ToolCallProps) {
  const [open, setOpen] = useState(false);
  const pending = !result && running;
  const argumentSummary = summarizeArguments(call.arguments);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger aria-label={`${pending ? "Using" : "Used"} ${call.name}`} className={TOOL_CHIP_CLASS}>
        <Wrench className="text-muted-foreground" />
        <code className="shrink-0 font-mono text-[0.8125rem]">{call.name}</code>
        {argumentSummary && (
          <span className="text-muted-foreground min-w-0 truncate text-xs" title={argumentSummary}>
            {argumentSummary}
          </span>
        )}
        <ToolStatusIcon results={[result]} running={running} />
        <ChevronRight className={cn("text-muted-foreground transition-transform", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 border-l pl-4">
        <JsonViewer title="Arguments" value={call.arguments} />
        {result && <JsonViewer title={result.isError ? "Error" : "Result"} value={parseContent(result.content)} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Parses JSON tool results so they render as a tree; anything else stays a string. */
function parseContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function Notice({ muted, children }: { muted?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        muted ? "text-muted-foreground" : "text-destructive",
        "flex items-start gap-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
      )}
    >
      <CircleAlert />
      <p>{children}</p>
    </div>
  );
}
