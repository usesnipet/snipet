import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useUsageCalls } from "@snipet/client";
import { ListFilter, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

import { dayRange, formatCompact, formatTime, formatUsd, formatUsdFine, formatWhole, totalTokens } from "../lib";

import type { UsageCall, UsageReportRow } from "@snipet/shared";

type DayDetailProps = {
  /** YYYY-MM-DD, UTC. */
  day: string;
  /** The day's row of the daily report, for the headline. */
  totals: UsageReportRow;
  /** Set when the page is filtered by an agent; the day is then only that agent's. */
  agentId: string | undefined;
  onClose: () => void;
};

/** The API's cap on one listing; a day with more calls shows its latest ones. */
const CALLS_LIMIT = 500;

const longDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** One day opened from the chart: its calls one by one, with their tokens and cost. */
export function DayDetail({ day, totals, agentId, onClose }: DayDetailProps) {
  const range = useMemo(() => dayRange(day), [day]);
  const callsQuery = useUsageCalls({ ...range, agentId });

  if (callsQuery.error) throw callsQuery.error;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      aria-labelledby="usage-day"
      className="bg-muted/30 -mx-3 space-y-5 rounded-xl border px-3 py-5 sm:-mx-5 sm:px-5"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id="usage-day" className="text-lg font-semibold tracking-tight">
            {longDay(day)}
          </h2>
          <p className="text-muted-foreground text-sm tabular-nums">
            {formatWhole(totals.calls)} {totals.calls === 1 ? "call" : "calls"}, {formatCompact(totalTokens(totals))}{" "}
            tokens
            {totals.cost !== null && (
              <>
                , about <span className="text-foreground font-medium">{formatUsd(totals.cost)}</span>
              </>
            )}
            . Times in UTC.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close day">
          <X aria-hidden />
        </Button>
      </header>

      {callsQuery.data ? (
        <CallsTable
          calls={callsQuery.data}
          isStale={callsQuery.isPlaceholderData}
          hiddenCount={callsQuery.data.length === CALLS_LIMIT ? totals.calls - CALLS_LIMIT : 0}
        />
      ) : (
        <ListSkeleton />
      )}
    </motion.section>
  );
}

type CallsTableProps = {
  calls: UsageCall[];
  isStale: boolean;
  /** Calls of the day past the API's cap, not listed. */
  hiddenCount: number;
};

/** The column filters; an absent key shows every call. */
type CallFilters = {
  agentId?: string;
  model?: string;
  connectionId?: string;
  cost?: "priced" | "unpriced";
};

const COST_OPTIONS = [
  { value: "priced", label: "With cost" },
  { value: "unpriced", label: "No price" },
];

/** The distinct values of a column, as filter options sorted by name. */
function optionsOf(calls: UsageCall[], value: (call: UsageCall) => string, label: (call: UsageCall) => string) {
  const byValue = new Map(calls.map((call) => [value(call), label(call)]));
  return [...byValue]
    .map(([key, name]) => ({ value: key, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const agentLabel = (call: UsageCall) => call.agentName ?? "Deleted agent";
const connectionLabel = (call: UsageCall) => call.connectionName ?? "Deleted connection";

/**
 * Every call of the day, newest first, filtered from the column headers. It scrolls inside a
 * capped height with the header pinned, so the page and its filters stay within reach.
 * A wash behind each cost shows it against the day's costliest call.
 */
function CallsTable({ calls, isStale, hiddenCount }: CallsTableProps) {
  const [filters, setFilters] = useState<CallFilters>({});
  const setFilter = <K extends keyof CallFilters>(key: K, value: CallFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const visibleCalls = calls.filter(
    (call) =>
      (!filters.agentId || call.agentId === filters.agentId) &&
      (!filters.model || call.model === filters.model) &&
      (!filters.connectionId || call.connectionId === filters.connectionId) &&
      (!filters.cost || (filters.cost === "priced") === (call.cost !== null)),
  );
  const isFiltered = Object.values(filters).some(Boolean);
  const maxCost = Math.max(0, ...visibleCalls.map((call) => call.cost ?? 0));
  const visibleCost = visibleCalls.reduce((sum, call) => sum + (call.cost ?? 0), 0);

  return (
    <div className={cn("space-y-2 transition-opacity", isStale && "opacity-50")}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <p className="text-muted-foreground tabular-nums" aria-live="polite">
          {isFiltered
            ? `${formatWhole(visibleCalls.length)} of ${formatWhole(calls.length)} calls, ${formatUsd(visibleCost)}`
            : "Filter from the column headers."}
        </p>
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            Clear filters
          </Button>
        )}
      </div>
      <div className="bg-background max-h-[28rem] overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <TableHeader className="bg-background sticky top-0 z-10 shadow-border shadow-[inset_0_-1px_0]">
            <TableRow className="hover:bg-transparent">
              <TableHead>Time</TableHead>
              <TableHead>
                <ColumnFilter
                  label="Agent"
                  options={optionsOf(calls, (call) => call.agentId, agentLabel)}
                  value={filters.agentId}
                  onChange={(value) => setFilter("agentId", value)}
                />
              </TableHead>
              <TableHead>
                <ColumnFilter
                  label="Model"
                  options={optionsOf(
                    calls,
                    (call) => call.model,
                    (call) => call.model,
                  )}
                  value={filters.model}
                  onChange={(value) => setFilter("model", value)}
                />
              </TableHead>
              <TableHead>
                <ColumnFilter
                  label="Connection"
                  options={optionsOf(calls, (call) => call.connectionId, connectionLabel)}
                  value={filters.connectionId}
                  onChange={(value) => setFilter("connectionId", value)}
                />
              </TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-28 text-right">
                <ColumnFilter
                  label="Cost"
                  options={COST_OPTIONS}
                  value={filters.cost}
                  onChange={(value) => setFilter("cost", value as CallFilters["cost"])}
                  align="end"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCalls.map((call) => {
              const total = totalTokens(call);
              return (
                <TableRow key={call.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{formatTime(call.createdAt)}</TableCell>
                  <TableCell className={cn("max-w-40 truncate", !call.agentName && "text-muted-foreground italic")}>
                    {agentLabel(call)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{call.model}</TableCell>
                  <TableCell
                    className={cn("max-w-40 truncate", !call.connectionName && "text-muted-foreground italic")}
                  >
                    {connectionLabel(call)}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground text-right tabular-nums"
                    title={`${formatWhole(call.inputTokens)} input tokens, ${formatWhole(call.cachedInputTokens)} of them from cache`}
                  >
                    {formatCompact(call.inputTokens)}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground text-right tabular-nums"
                    title={`${formatWhole(call.outputTokens)} output tokens`}
                  >
                    {formatCompact(call.outputTokens)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" title={`${formatWhole(total)} tokens`}>
                    {formatCompact(total)}
                  </TableCell>
                  <TableCell className="relative text-right font-medium tabular-nums">
                    {call.cost !== null && maxCost > 0 && (
                      <span
                        aria-hidden
                        className="bg-chart-1/15 absolute inset-y-1 right-0 rounded-sm"
                        style={{ width: `${(call.cost / maxCost) * 100}%` }}
                      />
                    )}
                    <span className="relative">
                      {call.cost === null ? (
                        <span className="text-muted-foreground font-normal">No price</span>
                      ) : (
                        formatUsdFine(call.cost)
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {visibleCalls.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                  No call matches these filters.{" "}
                  <button
                    type="button"
                    onClick={() => setFilters({})}
                    className="text-link underline-offset-4 hover:underline"
                  >
                    Clear filters
                  </button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <p className="text-muted-foreground text-xs">
          Showing the latest {formatWhole(CALLS_LIMIT)} calls; {formatWhole(hiddenCount)} earlier ones are counted in
          the totals but not listed.
        </p>
      )}
    </div>
  );
}

type ColumnFilterProps = {
  label: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  align?: "start" | "end";
};

/** A column header that opens its filter; while one is set the header shows the picked value. */
function ColumnFilter({ label, options, value, onChange, align = "start" }: ColumnFilterProps) {
  const picked = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:text-foreground focus-visible:ring-ring -mx-1.5 inline-flex max-w-44 items-center gap-1 rounded px-1.5 py-1 outline-none focus-visible:ring-2",
          picked && "bg-primary/10 text-foreground",
        )}
      >
        <span className="truncate">{picked ? `${label}: ${picked.label}` : label}</span>
        <ListFilter aria-hidden className={cn("size-3.5 shrink-0", !picked && "opacity-50")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-72 min-w-48 overflow-y-auto">
        <DropdownMenuRadioGroup value={value ?? ""} onValueChange={(next) => onChange(next || undefined)}>
          <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListSkeleton() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Loading the day</span>
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} aria-hidden className="h-9 w-full" />
      ))}
    </div>
  );
}
