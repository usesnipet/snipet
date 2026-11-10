import { SwapIcon } from "@/components/swap-icon";
import { Button } from "@/components/ui/button";
import { PromptInput, PromptInputAction, PromptInputActions, PromptInputTextarea } from "@/components/ui/prompt-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentAvatar } from "@/features/agent/components/agent-avatar";
import { ArrowUp, Square } from "lucide-react";
import { useState } from "react";

import type { AvailableAgent } from "@snipet/shared";

type Props = {
  agents: AvailableAgent[];
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
        <PromptInputTextarea autoFocus placeholder="Message the agent…" className="px-3 text-base" />
        <PromptInputActions className="justify-between px-1 pt-2">
          <Select value={agentId ?? ""} onValueChange={onAgentChange} disabled={agentLocked}>
            <SelectTrigger
              size="sm"
              className="h-8 w-auto max-w-60 gap-1.5 rounded-full"
              onClick={(event) => event.stopPropagation()}
              aria-label="Agent"
            >
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {/* The selected option's content also fills the trigger, avatar included. */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    <AgentAvatar avatar={agent.avatar} name={agent.name} className="size-5 shrink-0" />
                    <span className="truncate">{agent.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* One button for both, so the icon can swap in place instead of the button remounting. */}
          <PromptInputAction tooltip={running ? "Stop" : "Send"}>
            <Button
              size="icon"
              className="rounded-full"
              disabled={!running && !canSend}
              onClick={running ? onStop : submit}
              aria-label={running ? "Stop" : "Send"}
            >
              <SwapIcon swapKey={running ? "stop" : "send"}>
                {running ? <Square className="fill-current" /> : <ArrowUp />}
              </SwapIcon>
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
      <p className="text-muted-foreground text-center text-xs">Agents can make mistakes. Check important info.</p>
    </div>
  );
}
