import { Button } from "@/components/ui/button";
import { InputSearch } from "@/components/ui/input-search";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AgentAvatar } from "@/features/agent/components/agent-avatar";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Users } from "lucide-react";
import { useState } from "react";

import { formatCompact, formatUsd, totalTokens } from "../lib";

import type { UsageReportRow } from "@snipet/shared";

type AgentPickerProps = {
  /** The period's agents, ranked by tokens. */
  rows: UsageReportRow[];
  /** Avatar URLs by agent id; agents missing from it get their initials. */
  avatars: Map<string, string | null>;
  selectedId: string | undefined;
  onSelect: (agentId: string | undefined) => void;
};

const nameOf = (row: UsageReportRow) => row.label ?? "Deleted agent";

/**
 * Narrows the page to one agent. A button in the header that opens the agents ranked by tokens,
 * searchable and scrolling, so it stays one click away however many agents there are.
 */
export function AgentPicker({ rows, avatars, selectedId, onSelect }: AgentPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = rows.find((row) => row.key === selectedId);
  const max = Math.max(1, ...rows.map(totalTokens));
  const hasCost = rows.some((row) => row.cost !== null);
  const term = search.trim().toLowerCase();
  const matches = term ? rows.filter((row) => nameOf(row).toLowerCase().includes(term)) : rows;

  const pick = (agentId: string | undefined) => {
    onSelect(agentId);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="max-w-56 gap-2 pl-2">
          {selected ? (
            <AgentAvatar avatar={avatars.get(selected.key)} name={selected.label ?? undefined} className="size-6" />
          ) : (
            <Users aria-hidden className="text-muted-foreground size-4" />
          )}
          <span className="truncate">{selected ? nameOf(selected) : "All agents"}</span>
          <ChevronDown aria-hidden className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b p-2">
          <InputSearch
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${rows.length} agents`}
            aria-label="Search agents"
            className="h-9"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1" aria-label="Agents, most tokens first">
          {!term && (
            <li>
              <PickerRow isSelected={!selectedId} onClick={() => pick(undefined)}>
                <span className="bg-muted flex size-7 items-center justify-center rounded-lg">
                  <Users aria-hidden className="text-muted-foreground size-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium">All agents</span>
              </PickerRow>
            </li>
          )}
          {matches.map((row) => (
            <li key={row.key}>
              <PickerRow isSelected={row.key === selectedId} onClick={() => pick(row.key)}>
                <AgentAvatar avatar={avatars.get(row.key)} name={row.label ?? undefined} className="size-7" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className={cn("block truncate", !row.label && "text-muted-foreground italic")}>
                    {nameOf(row)}
                  </span>
                  {/* Its share against the busiest agent, so the ranking reads at a glance. */}
                  <span aria-hidden className="bg-muted block h-1 overflow-hidden rounded-full">
                    <span
                      className="bg-chart-2 block h-full rounded-full"
                      style={{ width: `${(totalTokens(row) / max) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="text-muted-foreground text-right text-xs tabular-nums">
                  {hasCost && row.cost !== null ? formatUsd(row.cost) : `${formatCompact(totalTokens(row))} tokens`}
                </span>
              </PickerRow>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="text-muted-foreground px-3 py-6 text-center text-sm">No agent matches “{search.trim()}”.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

type PickerRowProps = { isSelected: boolean; onClick: () => void; children: React.ReactNode };

function PickerRow({ isSelected, onClick, children }: PickerRowProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm outline-none",
        "hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring focus-visible:ring-2",
      )}
    >
      {children}
      <Check aria-hidden className={cn("size-4 shrink-0", !isSelected && "invisible")} />
    </button>
  );
}
