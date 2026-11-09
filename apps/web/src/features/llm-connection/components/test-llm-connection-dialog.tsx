import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CircleAlert, Loader2, Play, Square } from "lucide-react";
import { useId, useState } from "react";

import { useExecuteLlmStream, useLLMModels } from "@snipet/client";
import { LlmCapability } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";
import type { LlmConnection } from "@snipet/shared";

type TestLlmConnectionDialogProps = DialogInstanceProps<{
  connection: LlmConnection;
}>;

/** Short enough to answer fast and cheap, specific enough to show the model actually generated text. */
const DEFAULT_PROMPT = "Reply with one short sentence saying which model you are.";

/**
 * Sends one prompt to one model of a connection, to check it really generates
 * text. A sync only proves the key can list models; quota, model access or a
 * broken compatible endpoint only show up here.
 */
export function TestLlmConnectionDialog({ connection }: TestLlmConnectionDialogProps) {
  const promptId = useId();
  const modelId = useId();
  const { data: models = [], isLoading: isLoadingModels } = useLLMModels(connection.llmKey, {
    searchParams: { connectionId: connection.id },
  });
  const textModels = models.filter((model) => model.capabilities.includes(LlmCapability.TEXT));
  const [pickedModelKey, setPickedModelKey] = useState<string>();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const stream = useExecuteLlmStream();

  // Falls back to the first model so the test runs in one click.
  const modelKey = pickedModelKey ?? textModels[0]?.key;
  const isStreaming = stream.status === "streaming";
  const usage = stream.events.find((event) => event.event === "usage")?.data;

  const runTest = async () => {
    if (!modelKey) return;
    setDurationMs(null);
    const startedAt = performance.now();
    await stream.execute({
      targets: [{ model: `${connection.llmKey}/${modelKey}`, connectionId: connection.id }],
      messages: [{ role: "user", parts: [{ type: "text", text: prompt }] }],
    });
    setDurationMs(performance.now() - startedAt);
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Test {connection.name}</DialogTitle>
        <DialogDescription>Send a prompt to one of its models to check it answers.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={modelId}>Model</Label>
          <Select value={modelKey} onValueChange={setPickedModelKey} disabled={isStreaming || textModels.length === 0}>
            <SelectTrigger id={modelId} className="w-full">
              <SelectValue placeholder={isLoadingModels ? "Loading models…" : "No text models synced"} />
            </SelectTrigger>
            <SelectContent>
              {textModels.map((model) => (
                <SelectItem key={model.key} value={model.key}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLoadingModels && textModels.length === 0 && (
            <p className="text-muted-foreground text-xs">Sync the connection to load its models, then test again.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={promptId}>Prompt</Label>
          <Textarea
            id={promptId}
            rows={2}
            value={prompt}
            disabled={isStreaming}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <TestResult
          status={stream.status}
          text={stream.text}
          error={stream.error?.message}
          durationMs={durationMs}
          usage={usage}
        />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Close
          </Button>
        </DialogClose>
        {isStreaming ? (
          <Button type="button" onClick={stream.cancel}>
            <Square />
            Stop
          </Button>
        ) : (
          <Button type="button" onClick={runTest} disabled={!modelKey || !prompt.trim()}>
            <Play />
            {stream.status === "idle" ? "Run test" : "Run again"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

type TestResultProps = {
  status: ReturnType<typeof useExecuteLlmStream>["status"];
  text: string;
  error?: string;
  durationMs: number | null;
  usage?: { inputTokens: number; outputTokens: number };
};

/** The reply as it streams in, then how long it took; on failure, the provider's error and where to fix it. */
function TestResult({ status, text, error, durationMs, usage }: TestResultProps) {
  if (status === "idle") return null;

  if (status === "error") {
    return (
      <div role="alert" className="border-destructive/40 bg-destructive/5 space-y-1 rounded-lg border p-3 text-sm">
        <p className="text-destructive flex items-center gap-2 font-medium">
          <CircleAlert className="size-4 shrink-0" />
          The model didn't answer
        </p>
        <p className="text-muted-foreground break-words">{error ?? "The request failed."}</p>
        <p className="text-muted-foreground text-xs">Check the API key, base URL or model access in Edit.</p>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="bg-muted/30 space-y-2 rounded-lg border p-3">
      <p className={cn("max-h-48 overflow-y-auto text-sm whitespace-pre-wrap", !text && "text-muted-foreground")}>
        {text || (status === "streaming" ? "Waiting for the first token…" : "The model answered with no text.")}
        {status === "streaming" && text && <Loader2 className="ml-1 inline size-3.5 animate-spin" />}
      </p>
      {status === "done" && durationMs !== null && (
        <p className="text-muted-foreground text-xs">
          Answered in {(durationMs / 1000).toFixed(1)} s
          {usage && `, ${usage.inputTokens} tokens in and ${usage.outputTokens} out`}
        </p>
      )}
    </div>
  );
}
