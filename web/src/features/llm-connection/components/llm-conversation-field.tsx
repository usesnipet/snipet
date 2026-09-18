import { FormTextarea } from "@/components/form/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, Clock, GripVertical, Loader2, Plus, Send,
  SkipForward, Square, X, Zap
} from "lucide-react";
import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { useExecuteLlm, useExecuteLlmStream } from "../hooks";

import type { ExecuteLlm, ExecuteLlmTarget, LlmMessage, LlmRole, LlmSkippedEvent } from "../schemas";
type Props = {
  /** Field-array path holding `LlmMessage[]` (see schemas.ts). */
  name: string;
  /** Field path holding `ExecuteLlmTarget[]` — read (not watched) when sending. */
  targetsName: string;
};

type SendMode = "stream" | "sync";

const ROLE_OPTIONS: { value: LlmRole; label: string }[] = [
  { value: "system", label: "System" },
  { value: "user", label: "User" },
  { value: "assistant", label: "Assistant" },
];

const ROLE_BADGE_CLASS: Record<string, string> = {
  system: "bg-muted text-muted-foreground",
  user: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  assistant: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

const ROLE_ACCENT_CLASS: Record<string, string> = {
  system: "border-l-transparent",
  user: "border-l-emerald-500/70",
  assistant: "border-l-sky-500/70",
};

const IDLE_MESSAGE = 'No response yet — click "Send" to try this conversation against your fallback chain.';

function newMessage(role: LlmRole = "user"): LlmMessage {
  return { role, parts: [{ type: "text", text: "" }] };
}

// extractText joins a message's TextParts — the only part type this builder
// produces, but a target's reply could in principle carry others.
function extractText(message: LlmMessage): string {
  return message.parts
    .filter((part): part is Extract<LlmMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/**
 * Renders the drag-to-reorder conversation builder (role + text per message)
 * plus the Send split-button that runs it against `targetsName`'s targets,
 * either streamed or in one shot (see useExecuteLlm / useExecuteLlmStream).
 */
export function LlmConversationField({ name, targetsName }: Props) {
  const form = useFormContext();
  const { fields, append, remove, move, replace } = useFieldArray({ control: form.control, name });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<SendMode>("stream");

  const runSync = useExecuteLlm();
  const stream = useExecuteLlmStream();

  const isStreaming = stream.status === "streaming";
  const isSending = mode === "stream" ? isStreaming : runSync.isPending;

  const handleDrop = (index: number) => () => {
    if (dragIndex === null || dragIndex === index) return;
    move(dragIndex, index);
    setDragIndex(null);
  };

  const handleSend = () => {
    const payload: ExecuteLlm = {
      targets: form.getValues(targetsName) as ExecuteLlmTarget[],
      messages: form.getValues(name) as LlmMessage[],
    };
    if (mode === "stream") {
      void stream.execute(payload);
    } else {
      runSync.mutate({ data: payload });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>Add messages, set their role, and drag to reorder.</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => append({ model: "" })}>
            <Plus />
            Add message
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop(index)}>
              <LlmMessageRow
                name={name}
                index={index}
                total={fields.length}
                onRemove={() => remove(index)}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                onDragStart={() => setDragIndex(index)}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs">
            {fields.length} message{fields.length === 1 ? "" : "s"} in this conversation
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSending}
              onClick={() => replace([newMessage()])}
            >
              Clear conversation
            </Button>

            <div className="flex items-center">
              {isStreaming ? (
                <Button type="button" size="sm" className="rounded-r-none" onClick={() => stream.cancel()}>
                  <Square />
                  Stop
                </Button>
              ) : (
                <Button type="button" size="sm" className="rounded-r-none" disabled={isSending} onClick={handleSend}>
                  {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                  Send
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    disabled={isSending}
                    className="rounded-l-none border-l border-l-primary-foreground/20"
                    aria-label="Send options"
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setMode("stream")}>
                    {mode === "stream" ? <Check /> : <span className="size-4" />}
                    Stream response
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setMode("sync")}>
                    {mode === "sync" ? <Check /> : <span className="size-4" />}
                    Without streaming
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <ScrollArea className="flex max-h-96 flex-col">
          <ResultStatus mode={mode} stream={stream} runSync={runSync} />
        </ScrollArea>
      </CardFooter>
    </Card>
  );
}

type ResultStatusProps = {
  mode: SendMode;
  stream: ReturnType<typeof useExecuteLlmStream>;
  runSync: ReturnType<typeof useExecuteLlm>;
};

function ResultStatus({ mode, stream, runSync }: ResultStatusProps) {
  if (mode === "stream") {
    if (stream.status === "idle") return <IdleStatus />;
    if (stream.status === "error") {
      return (
        <div className="space-y-1">
          <SkippedList skipped={stream.skipped} />
          <ErrorStatus message={stream.error?.message ?? "Something went wrong."} />
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <SkippedList skipped={stream.skipped} />
        {stream.activeLlm && (
          <StatusRow icon={<Zap />} className="text-foreground/70">
            {stream.activeLlm}
          </StatusRow>
        )}
        <StatusRow icon={stream.status === "streaming" ? <Loader2 className="animate-spin" /> : <CircleCheck />}>
          {stream.text || (stream.status === "streaming" ? "Waiting for the first token…" : "(empty response)")}
        </StatusRow>
      </div>
    );
  }

  if (runSync.isIdle) return <IdleStatus />;
  if (runSync.isPending) return <StatusRow icon={<Loader2 className="animate-spin" />}>Running…</StatusRow>;
  if (runSync.isError) return <ErrorStatus message={runSync.error.message} />;
  return (
    <StatusRow icon={<CircleCheck />}>{extractText(runSync.data.message) || "(empty response)"}</StatusRow>
  );
}

function SkippedList({ skipped }: { skipped: LlmSkippedEvent[] }) {
  if (skipped.length === 0) return null;
  return (
    <>
      {skipped.map((s, i) => (
        <StatusRow key={`${s.llm}-${i}`} icon={<SkipForward />} className="text-amber-600 dark:text-amber-400">
          {s.llm} skipped — {s.error}
        </StatusRow>
      ))}
    </>
  );
}

function IdleStatus() {
  return <StatusRow icon={<Clock />}>{IDLE_MESSAGE}</StatusRow>;
}

function ErrorStatus({ message }: { message: string }) {
  return (
    <StatusRow icon={<CircleAlert />} className="text-destructive">
      {message}
    </StatusRow>
  );
}

function StatusRow({ icon, className, children }: { icon: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("text-muted-foreground flex items-start gap-2 text-xs [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0", className)}>
      {icon}
      <p className="whitespace-pre-wrap">{children}</p>
    </div>
  );
}

type MessageRowProps = {
  name: string;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
};

function LlmMessageRow({ name, index, total, onRemove, onMoveUp, onMoveDown, onDragStart }: MessageRowProps) {
  const form = useFormContext();
  const fieldPath = `${name}.${index}`;
  const role = (useWatch({ control: form.control, name: `${fieldPath}.role` }) as LlmRole | undefined) ?? "user";

  return (
    <div className={cn("space-y-2 rounded-lg border border-l-2 bg-muted/30 p-3", ROLE_ACCENT_CLASS[role])}>
      <div className="flex items-center gap-2">
        <span draggable onDragStart={onDragStart} className="cursor-grab">
          <GripVertical className="text-muted-foreground/60 size-4 shrink-0" />
        </span>
        <Select value={role} onValueChange={(next) => form.setValue(`${fieldPath}.role`, next, { shouldDirty: true })}>
          <SelectTrigger
            size="sm"
            className={cn(
              "h-6 w-auto gap-1 rounded-full border-none px-2.5 text-[11px] font-semibold uppercase tracking-wide shadow-none",
              ROLE_BADGE_CLASS[role],
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={onMoveUp}>
          <ChevronUp />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={index === total - 1} onClick={onMoveDown}>
          <ChevronDown />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={total <= 1} onClick={onRemove}>
          <X />
        </Button>
      </div>

      <FormTextarea name={`${fieldPath}.parts.0.text`} rows={3} placeholder="Message content" />
    </div>
  );
}
