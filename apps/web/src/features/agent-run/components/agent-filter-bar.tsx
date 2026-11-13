import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AgentAvatar } from "@/features/agent/components/agent-avatar";
import { cn } from "@/lib/utils";
import { useState } from "react";

import type { AvailableAgent } from "@snipet/shared";

/** Two rows of six at the sidebar's fixed width, minus the slot of the "+N" button. */
const COLLAPSED_LIMIT = 11;

type Props = {
  agents: AvailableAgent[];
  activeAgentId: string | undefined;
  /** Called with the clicked agent; clicking the active one again clears the filter. */
  onToggle: (agentId: string) => void;
};

/** Filters the chat list by agent. With a single agent there's nothing to choose, so it renders nothing. */
export function AgentFilterBar({ agents, activeAgentId, onToggle }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (agents.length < 2) return null;

  const isCollapsed = !isExpanded && agents.length > COLLAPSED_LIMIT + 1;
  const firstAgents = agents.slice(0, COLLAPSED_LIMIT);
  const activeAgent = agents.find((agent) => agent.id === activeAgentId);
  // The active agent must stay visible, or nothing would show what the list is filtered by.
  const collapsedAgents =
    activeAgent && !firstAgents.includes(activeAgent) ? [...firstAgents.slice(0, -1), activeAgent] : firstAgents;
  const visibleAgents = isCollapsed ? collapsedAgents : agents;

  return (
    <div
      role="group"
      aria-label="Filter chats by agent"
      // The tray sets it apart from the chat rows below, which show the same avatars.
      className="bg-sidebar-accent/60 flex w-fit max-w-full flex-wrap gap-1.5 rounded-[20px] p-1.5 group-data-[collapsible=icon]:hidden"
    >
      {visibleAgents.map((agent) => {
        const isActive = agent.id === activeAgentId;
        return (
          <Tooltip key={agent.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={agent.name}
                aria-pressed={isActive}
                onClick={() => onToggle(agent.id)}
                className={cn(
                  "focus-visible:ring-sidebar-ring rounded-full transition-opacity outline-none focus-visible:ring-2",
                  isActive && "ring-sidebar-primary ring-offset-sidebar ring-2 ring-offset-2",
                  activeAgentId && !isActive && "opacity-50 hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                <AgentAvatar
                  avatar={agent.avatar}
                  name={agent.name}
                  className="size-7 rounded-full *:rounded-full after:rounded-full"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>{agent.name}</TooltipContent>
          </Tooltip>
        );
      })}
      {isCollapsed && (
        <button
          type="button"
          aria-label={`Show ${agents.length - COLLAPSED_LIMIT} more agents`}
          onClick={() => setIsExpanded(true)}
          className="bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring flex size-7 items-center justify-center rounded-full text-[11px] font-medium outline-none focus-visible:ring-2"
        >
          +{agents.length - COLLAPSED_LIMIT}
        </button>
      )}
    </div>
  );
}
