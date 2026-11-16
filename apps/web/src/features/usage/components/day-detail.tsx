import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useUsageRuns } from "@snipet/client";
import { ChevronRight, ListFilter, X } from "lucide-react";
import { motion } from "motion/react";
import { Fragment, useMemo, useState } from "react";

import { dayRange, formatCompact, formatTime, formatUsd, formatUsdFine, formatWhole, totalTokens } from "../lib";

import type { UsageCall, UsageReportRow, UsageRun } from "@snipet/shared";

type DayDetailProps = {
  /** YYYY-MM-DD, UTC. */
  day: string;
  /** The day's row of the daily report, for the headline. */
  totals: UsageReportRow;
  /** Set when the page is filtered by an agent; the day is then only that agent's. */
  agentId: string | undefined;
  onClose: () => void;
};

/** The API's cap on one listing; a day with more runs shows its latest ones. */
const RUNS_LIMIT = 200;

const longDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** One day opened from the chart: its runs, each opening on the LLM calls it made. */
export function DayDetail({ day, totals, agentId, onClose }: DayDetailProps) {
  const range = useMemo(() => dayRange(day), [day]);
  const runsQuery = useUsageRuns({ ...range, agentId });

  if (runsQuery.error) throw runsQuery.error;

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

      {runsQuery.data ? (
        <RunsTable
          runs={runsQuery.data}
          isStale={runsQuery.isPlaceholderData}
          isCapped={runsQuery.data.length === RUNS_LIMIT}
        />
      ) : (
        <ListSkeleton />
      )}
    </motion.section>
  );
}

/** A run's calls added up, for its row and its filters. */
type RunSummary = {
  run: UsageRun;
  agentId: string;
  agentName: string | null;
  models: string[];
  connections: { id: string; name: string }[];
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  /** Null when none of its calls has a price. */
  cost: number | null;
};

const agentLabel = (call: Pick<UsageCall, "agentName">) => call.agentName ?? "Deleted agent";
const connectionLabel = (call: UsageCall) => call.connectionName ?? "Deleted connection";
const sum = (calls: UsageCall[], value: (call: UsageCall) => number) =>
  calls.reduce((total, call) => total + value(call), 0);

/** A run's agent is the same on every call; its model and connection may change on a fallback. */
function summarize(run: UsageRun): RunSummary {
  const [first] = run.calls;
  const pricedCalls = run.calls.filter((call) => call.cost !== null);
  return {
    run,
    agentId: first.agentId,
    agentName: first.agentName,
    models: [...new Set(run.calls.map((call) => call.model))],
    connections: [...new Map(run.calls.map((call) => [call.connectionId, connectionLabel(call)]))].map(
      ([id, name]) => ({ id, name }),
    ),
    inputTokens: sum(run.calls, (call) => call.inputTokens),
    outputTokens: sum(run.calls, (call) => call.outputTokens),
    cachedInputTokens: sum(run.calls, (call) => call.cachedInputTokens),
    cost: pricedCalls.length ? sum(pricedCalls, (call) => call.cost ?? 0) : null,
  };
}

type RunsTableProps = {
  runs: UsageRun[];
  isStale: boolean;
  /** True when the API cut the list at its cap, so the day's earlier runs aren't listed. */
  isCapped: boolean;
};

/** The column filters; an absent key shows every run. A run matches a model or connection any of its calls used. */
type RunFilters = {
  agentId?: string;
  model?: string;
  connectionId?: string;
  cost?: "priced" | "unpriced";
};

const COST_OPTIONS = [
  { value: "priced", label: "With cost" },
  { value: "unpriced", label: "No price" },
];

/** The distinct values of a column across every call, as filter options sorted by name. */
function optionsOf(calls: UsageCall[], value: (call: UsageCall) => string, label: (call: UsageCall) => string) {
  const byValue = new Map(calls.map((call) => [value(call), label(call)]));
  return [...byValue]
    .map(([key, name]) => ({ value: key, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** "claude-haiku-4-5", or "2 models" with the names on hover. */
function ListCell({ names, noun, className }: { names: string[]; noun: string; className?: string }) {
  return (
    <TableCell className={cn("max-w-48 truncate", className)} title={names.join(", ")}>
      {names.length === 1 ? names[0] : `${names.length} ${noun}`}
    </TableCell>
  );
}

/** The columns, for the empty row's span. */
const COLUMN_COUNT = 10;

/**
 * The day's runs, newest first, filtered from the column headers; a run opens on its calls.
 * It scrolls inside a capped height with the header pinned, so the page and its filters stay
 * within reach. A wash behind each cost shows it against the day's costliest run.
 */
function RunsTable({ runs, isStale, isCapped }: RunsTableProps) {
  const [filters, setFilters] = useState<RunFilters>({});
  const [openRunIds, setOpenRunIds] = useState<Set<string>>(() => new Set());
  const setFilter = <K extends keyof RunFilters>(key: K, value: RunFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const toggleRun = (runId: string) =>
    setOpenRunIds((current) => {
      const next = new Set(current);
      if (!next.delete(runId)) next.add(runId);
      return next;
    });

  const summaries = useMemo(() => runs.filter((run) => run.calls.length > 0).map(summarize), [runs]);
  const allCalls = useMemo(() => runs.flatMap((run) => run.calls), [runs]);
  const visibleRuns = summaries.filter(
    (summary) =>
      (!filters.agentId || summary.agentId === filters.agentId) &&
      (!filters.model || summary.models.includes(filters.model)) &&
      (!filters.connectionId || summary.connections.some((connection) => connection.id === filters.connectionId)) &&
      (!filters.cost || (filters.cost === "priced") === (summary.cost !== null)),
  );
  const isFiltered = Object.values(filters).some(Boolean);
  const maxCost = Math.max(0, ...visibleRuns.map((summary) => summary.cost ?? 0));
  const visibleCost = visibleRuns.reduce((total, summary) => total + (summary.cost ?? 0), 0);

  return (
    <div className={cn("space-y-2 transition-opacity", isStale && "opacity-50")}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <p className="text-muted-foreground tabular-nums" aria-live="polite">
          {isFiltered
            ? `${formatWhole(visibleRuns.length)} of ${formatWhole(summaries.length)} runs, ${formatUsd(visibleCost)}`
            : `${formatWhole(summaries.length)} ${summaries.length === 1 ? "run" : "runs"}. Open one to see its calls.`}
        </p>
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            Clear filters
          </Button>
        )}
      </div>
      <div className="bg-background max-h-[28rem] overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <TableHeader className="bg-background shadow-border sticky top-0 z-10 shadow-[inset_0_-1px_0]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">
                <span className="sr-only">Open</span>
              </TableHead>
              <TableHead>Started</TableHead>
              <TableHead>
                <ColumnFilter
                  label="Agent"
                  options={optionsOf(allCalls, (call) => call.agentId, agentLabel)}
                  value={filters.agentId}
                  onChange={(value) => setFilter("agentId", value)}
                />
              </TableHead>
              <TableHead>
                <ColumnFilter
                  label="Model"
                  options={optionsOf(
                    allCalls,
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
                  options={optionsOf(allCalls, (call) => call.connectionId, connectionLabel)}
                  value={filters.connectionId}
                  onChange={(value) => setFilter("connectionId", value)}
                />
              </TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-28 text-right">
                <ColumnFilter
                  label="Cost"
                  options={COST_OPTIONS}
                  value={filters.cost}
                  onChange={(value) => setFilter("cost", value as RunFilters["cost"])}
                  align="end"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRuns.map((summary) => {
              const { run } = summary;
              const isOpen = openRunIds.has(run.runId);
              const callCount = run.calls.length;
              return (
                <Fragment key={run.runId}>
                  <TableRow
                    data-state={isOpen ? "selected" : undefined}
                    onClick={() => toggleRun(run.runId)}
                    className="cursor-pointer"
                  >
                    <TableCell className="pr-0">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} the ${callCount} ${callCount === 1 ? "call" : "calls"} of this run`}
                        // The row toggles too; this keeps a click on the button from toggling twice.
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRun(run.runId);
                        }}
                        className="hover:bg-accent focus-visible:ring-ring flex size-6 items-center justify-center rounded outline-none focus-visible:ring-2"
                      >
                        <ChevronRight
                          aria-hidden
                          className={cn("text-muted-foreground size-4 transition-transform", isOpen && "rotate-90")}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{formatTime(run.startedAt)}</TableCell>
                    <TableCell
                      className={cn("max-w-40 truncate", !summary.agentName && "text-muted-foreground italic")}
                    >
                      {agentLabel(summary)}
                    </TableCell>
                    <ListCell names={summary.models} noun="models" />
                    <ListCell names={summary.connections.map((connection) => connection.name)} noun="connections" />
                    <TableCell className="text-right tabular-nums">{formatWhole(callCount)}</TableCell>
                    <TokenCells {...summary} />
                    <CostCell cost={summary.cost} maxCost={maxCost} />
                  </TableRow>
                  {isOpen &&
                    run.calls.map((call) => (
                      <TableRow key={call.id} className="bg-muted/40 hover:bg-muted/60 text-xs">
                        <TableCell />
                        <TableCell className="text-muted-foreground pl-5 tabular-nums">
                          {formatTime(call.createdAt)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="max-w-48 truncate">{call.model}</TableCell>
                        <TableCell
                          className={cn("max-w-40 truncate", !call.connectionName && "text-muted-foreground italic")}
                        >
                          {connectionLabel(call)}
                        </TableCell>
                        <TableCell />
                        <TokenCells {...call} />
                        <CostCell cost={call.cost} />
                      </TableRow>
                    ))}
                </Fragment>
              );
            })}
            {visibleRuns.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground py-10 text-center">
                  No run matches these filters.{" "}
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
      {isCapped && (
        <p className="text-muted-foreground text-xs">
          Showing the latest {formatWhole(RUNS_LIMIT)} runs; earlier ones are counted in the totals but not listed.
        </p>
      )}
    </div>
  );
}

type Tokens = Pick<UsageCall, "inputTokens" | "outputTokens" | "cachedInputTokens">;

/** Input, output and total, compact, the exact counts on hover. */
function TokenCells({ inputTokens, outputTokens, cachedInputTokens }: Tokens) {
  const total = totalTokens({ inputTokens, outputTokens });
  return (
    <>
      <TableCell
        className="text-muted-foreground text-right tabular-nums"
        title={`${formatWhole(inputTokens)} input tokens, ${formatWhole(cachedInputTokens)} of them from cache`}
      >
        {formatCompact(inputTokens)}
      </TableCell>
      <TableCell
        className="text-muted-foreground text-right tabular-nums"
        title={`${formatWhole(outputTokens)} output tokens`}
      >
        {formatCompact(outputTokens)}
      </TableCell>
      <TableCell className="text-right tabular-nums" title={`${formatWhole(total)} tokens`}>
        {formatCompact(total)}
      </TableCell>
    </>
  );
}

/** The cost, with a wash against maxCost when given; a call inside a run gets none. */
function CostCell({ cost, maxCost = 0 }: { cost: number | null; maxCost?: number }) {
  return (
    <TableCell className="relative text-right font-medium tabular-nums">
      {cost !== null && maxCost > 0 && (
        <span
          aria-hidden
          className="bg-chart-1/15 absolute inset-y-1 right-0 rounded-sm"
          style={{ width: `${(cost / maxCost) * 100}%` }}
        />
      )}
      <span className="relative">
        {cost === null ? <span className="text-muted-foreground font-normal">No price</span> : formatUsdFine(cost)}
      </span>
    </TableCell>
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
