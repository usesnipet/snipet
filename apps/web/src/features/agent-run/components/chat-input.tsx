import { Button } from "@/components/ui/button";
import { PromptInput, PromptInputAction, PromptInputActions, PromptInputTextarea } from "@/components/ui/prompt-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, Bot, Square } from "lucide-react";
import { useState } from "react";

import type { Agent } from "@/models/agent";

type Props = {
  agents: Agent[];
  agentId: string | undefined;
  onAgentChange: (agentId: string) => void;
  /** Locks the agent select, e.g. while a session is open. */
  agentLocked: boolean;
  running: boolean;
  sending: boolean;
  onSend: (input: string) => void;
  onStop: () => void;
};

export function ChatInput({ agents, agentId, onAgentChange, agentLocked, running, sending, onSend, onStop }: Props) {
  const [value, setValue] = useState("");
  const canSend = !!agentId && value.trim().length > 0 && !running && !sending;

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <div className="flex flex-col gap-2">
      <PromptInput value={value} onValueChange={setValue} onSubmit={submit} isLoading={running || sending}>
        <PromptInputTextarea placeholder="Message the agent…" className="px-3 text-base" />
        <PromptInputActions className="justify-between px-1 pt-2">
          <Select value={agentId ?? ""} onValueChange={onAgentChange} disabled={agentLocked}>
            <SelectTrigger
              size="sm"
              className="h-8 w-auto max-w-60 gap-1.5 rounded-full"
              onClick={(event) => event.stopPropagation()}
              aria-label="Agent"
            >
              <Bot />
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {running ? (
            <PromptInputAction tooltip="Stop">
              <Button size="icon" className="rounded-full" onClick={onStop} aria-label="Stop">
                <Square className="fill-current" />
              </Button>
            </PromptInputAction>
          ) : (
            <PromptInputAction tooltip="Send">
              <Button size="icon" className="rounded-full" disabled={!canSend} onClick={submit} aria-label="Send">
                <ArrowUp />
              </Button>
            </PromptInputAction>
          )}
        </PromptInputActions>
      </PromptInput>
      <p className="text-muted-foreground text-center text-xs">Agents can make mistakes. Check important info.</p>
    </div>
  );
}
