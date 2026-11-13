import { PageActions } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ROUTES } from "@/routes";
import { useListAgents, useUsageReport } from "@snipet/client";
import { UsageGroupBy } from "@snipet/shared";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { fillDays, periodRange, PERIODS } from "../lib";

import { AgentPicker } from "./agent-picker";
import { DailyChart } from "./daily-chart";
import { DayDetail } from "./day-detail";
import { UsageSummary } from "./usage-summary";

import type { Period } from "../lib";
import type { UsageReportRow } from "@snipet/shared";
/** Sums the agents' rows; a cost only when some agent has one. */
function sumRows(rows: UsageReportRow[]): Omit<UsageReportRow, "key" | "label"> {
  const costs = rows.flatMap((row) => (row.cost === null ? [] : [row.cost]));
  return {
    calls: rows.reduce((sum, row) => sum + row.calls, 0),
    inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
    outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
    cachedInputTokens: rows.reduce((sum, row) => sum + row.cachedInputTokens, 0),
    inputCost: null,
    outputCost: null,
    cost: costs.length ? costs.reduce((sum, cost) => sum + cost, 0) : null,
  };
}

/** The usage page's body: the agent and period pickers, the totals, tokens per day and the picked day's calls. */
export function UsageDashboard() {
  const [period, setPeriod] = useLocalStorage<Period>("usage-period", 30);
  const [agentId, setAgentId] = useState<string>();
  const [selectedDay, setSelectedDay] = useState<string>();
  const range = useMemo(() => periodRange(period), [period]);

  const agentsReport = useUsageReport({ ...range, groupBy: UsageGroupBy.AGENT });
  const dailyReport = useUsageReport({ ...range, groupBy: UsageGroupBy.DAY, agentId });
  const { data: agents } = useListAgents({ searchParams: { take: 500 } });
  const avatars = useMemo(() => new Map(agents?.data.map((agent) => [agent.id, agent.avatar])), [agents]);

  if (agentsReport.error) throw agentsReport.error;
  if (dailyReport.error) throw dailyReport.error;

  const changePeriod = (value: string) => {
    setPeriod(Number(value) as Period);
    // The agent may have no calls in the new period, which would leave the chart filtered by an absent row.
    setAgentId(undefined);
    setSelectedDay(undefined);
  };

  const changeAgent = (value: string | undefined) => {
    setAgentId(value);
    // The day may have no calls by the new agent.
    setSelectedDay(undefined);
  };

  const periodPicker = (
    <PageActions>
      {agentsReport.data && agentsReport.data.length > 0 && (
        <AgentPicker rows={agentsReport.data} avatars={avatars} selectedId={agentId} onSelect={changeAgent} />
      )}
      <Tabs value={String(period)} onValueChange={changePeriod}>
        <TabsList aria-label="Period">
          {PERIODS.map((days) => (
            <TabsTrigger key={days} value={String(days)}>
              {days} days
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </PageActions>
  );

  if (!agentsReport.data || !dailyReport.data) {
    return (
      <>
        {periodPicker}
        <UsageSkeleton />
      </>
    );
  }

  const rows = agentsReport.data;
  if (rows.length === 0) {
    return (
      <>
        {periodPicker}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <BarChart3 aria-hidden className="text-muted-foreground size-10" strokeWidth={1.5} />
          <p className="text-lg font-medium">No agent ran in the last {period} days</p>
          <p className="text-muted-foreground max-w-sm text-sm text-pretty">
            Every reply an agent writes counts its tokens here.{" "}
            <Link to={ROUTES.chat} className="text-link underline-offset-4 hover:underline">
              Start a chat
            </Link>{" "}
            to see the first ones.
          </p>
        </div>
      </>
    );
  }

  const selected = rows.find((row) => row.key === agentId);
  // Undefined when the picked agent has no calls that day, which closes the day.
  const selectedDayRow = dailyReport.data.find((row) => row.key === selectedDay);
  return (
    <div className="space-y-12 pb-8">
      {periodPicker}
      <UsageSummary
        totals={selected ?? sumRows(rows)}
        days={period}
        agentName={selected ? (selected.label ?? "a deleted agent") : undefined}
      />
      <DailyChart
        days={fillDays(dailyReport.data, range.from, period)}
        isStale={dailyReport.isPlaceholderData}
        selectedDay={selectedDayRow?.key}
        onSelectDay={setSelectedDay}
      />
      {selectedDayRow && (
        <DayDetail
          key={selectedDayRow.key}
          day={selectedDayRow.key}
          totals={selectedDayRow}
          agentId={agentId}
          onClose={() => setSelectedDay(undefined)}
        />
      )}
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div role="status" className="space-y-12">
      <span className="sr-only">Loading usage</span>
      <div className="space-y-4">
        <Skeleton aria-hidden className="h-14 w-full max-w-xl" />
        <Skeleton aria-hidden className="h-4 w-72" />
      </div>
      <Skeleton aria-hidden className="h-48 w-full sm:h-60" />
    </div>
  );
}
