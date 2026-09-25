import { JsonViewer } from "@/components/json-viewer";
import { Button } from "@/components/ui/button";
import {
  ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor
} from "@/components/ui/chat-container";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader } from "@/components/ui/loader";
import { Markdown } from "@/components/ui/markdown";
import { MessageAction, MessageActions } from "@/components/ui/message";
import { ScrollButton } from "@/components/ui/scroll-button";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, CircleAlert, Copy, Wrench, X } from "lucide-react";
import { useState } from "react";

import type { AgentMessage, AgentRun } from "../schemas";
import type { LlmPart } from "@/models/llm-message";

type ToolCallPart = Extract<LlmPart, { type: "tool_call" }>;
type ToolResultPart = Extract<LlmPart, { type: "tool_result" }>;

type Props = {
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
  failed: "The run failed",
  cancelled: "Stopped",
  max_turns: "The agent hit its turn limit before finishing",
};

// No typography plugin is installed, so markdown elements are styled here.
const MARKDOWN_CLASS = cn(
  "space-y-3 leading-7 break-words",
  "[&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:space-y-1 [&_ul,&_ol]:pl-6",
  "[&_a]:text-primary [&_a]:underline [&_strong]:font-semibold",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:pl-4",
  "[&_table]:w-full [&_td,&_th]:border [&_td,&_th]:px-2 [&_td,&_th]:py-1 [&_th]:text-left [&_hr]:my-4",
);

const textOf = (message: AgentMessage) =>
  message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");

export function ChatMessages({ messages, pendingInput, draft, streaming, run, error }: Props) {
  // Tool results are rendered inside their call, keyed by tool_call_id.
  const results = new Map<string, ToolResultPart>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "tool_result") results.set(part.tool_call_id, part);
    }
  }

  const last = messages.at(-1);
  const waiting = streaming && !draft && (pendingInput !== null || last?.role !== "assistant" || hasOpenCalls(last, results));
  const notice = !streaming && run ? RUN_NOTICES[run.status] : undefined;

  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="mx-auto max-w-3xl gap-6 px-4 py-8">
        {messages.map((message) => {
          if (message.role === "user") return <UserBubble key={message.id} text={textOf(message)} />;
          if (message.role === "assistant") {
            return <AssistantMessage key={message.id} message={message} results={results} streaming={streaming} />;
          }
          return null;
        })}
        {pendingInput !== null && <UserBubble text={pendingInput} />}
        {draft && <Markdown className={MARKDOWN_CLASS}>{draft}</Markdown>}
        {waiting && <Loader variant="typing" size="sm" />}
        {notice && (
          <Notice muted={run?.status === "cancelled"}>
            {notice}
            {run?.error ? `: ${run.error}` : "."}
          </Notice>
        )}
        {error && <Notice>{error.message}</Notice>}
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  );
}

function hasOpenCalls(message: AgentMessage, results: Map<string, ToolResultPart>) {
  return message.parts.some((part) => part.type === "tool_call" && !results.has(part.id));
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-muted max-w-[80%] rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words">{text}</div>
    </div>
  );
}

type AssistantMessageProps = {
  message: AgentMessage;
  results: Map<string, ToolResultPart>;
  streaming: boolean;
};

function AssistantMessage({ message, results, streaming }: AssistantMessageProps) {
  const text = textOf(message);
  return (
    <div className="group flex flex-col gap-2">
      {message.parts.map((part, i) => {
        if (part.type === "text" && part.text) {
          return (
            <Markdown key={i} className={MARKDOWN_CLASS}>
              {part.text}
            </Markdown>
          );
        }
        if (part.type === "tool_call") {
          return <ToolCall key={part.id} call={part} result={results.get(part.id)} running={streaming} />;
        }
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
        {copied ? <Check /> : <Copy />}
      </Button>
    </MessageAction>
  );
}

type ToolCallProps = {
  call: ToolCallPart;
  result: ToolResultPart | undefined;
  /** The run is live, so a call without a result is still executing. */
  running: boolean;
};

function ToolCall({ call, result, running }: ToolCallProps) {
  const [open, setOpen] = useState(false);
  const pending = !result && running;

  let icon = <Loader variant="circular" size="sm" />;
  if (result?.is_error) icon = <X className="text-destructive" />;
  else if (result) icon = <Check className="text-emerald-600 dark:text-emerald-400" />;
  else if (!running) icon = <CircleAlert className="text-muted-foreground" />;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors [&_svg]:size-3.5">
        <Wrench />
        <span>
          {pending ? "Using" : "Used"} <code className="font-mono text-xs">{call.name}</code>
        </span>
        {icon}
        <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 border-l pl-4">
        <JsonViewer title="Arguments" value={call.arguments} />
        {result && <JsonViewer title={result.is_error ? "Error" : "Result"} value={parseContent(result.content)} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

// parseContent shows JSON results as a tree and anything else as a string.
function parseContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function Notice({ muted, children }: { muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(muted ? "text-muted-foreground" : "text-destructive", "flex items-start gap-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0")}>
      <CircleAlert />
      <p>{children}</p>
    </div>
  );
}
