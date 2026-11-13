import { cn } from "@/lib/utils";

import { formatCompact, formatUsd, formatWhole, PART_COLORS, tokenParts, totalTokens } from "../lib";
import { AnimatedNumber } from "./animated-number";

import type { UsageReportRow } from "@snipet/shared";

type UsageSummaryProps = {
  totals: Omit<UsageReportRow, "key" | "label">;
  days: number;
  /** Set when one agent is picked; the summary is then that agent's. */
  agentName?: string;
};

/** The period's totals as one sentence, its numbers set large, and the legend of the bars below. */
export function UsageSummary({ totals, days, agentName }: UsageSummaryProps) {
  const parts = tokenParts(totals);
  return (
    <section aria-label="Totals" className="space-y-4">
      <p className="text-muted-foreground max-w-3xl text-xl leading-snug text-balance sm:text-2xl">
        <AnimatedNumber
          value={totalTokens(totals)}
          format={formatCompact}
          className="text-foreground text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
        />{" "}
        tokens in{" "}
        <AnimatedNumber
          value={totals.calls}
          format={formatWhole}
          className="text-foreground font-semibold tabular-nums"
        />{" "}
        {totals.calls === 1 ? "call" : "calls"}
        {agentName && (
          <>
            {" "}
            by <span className="text-foreground font-medium">{agentName}</span>
          </>
        )}{" "}
        over the last {days} days
        {totals.cost !== null && (
          <>
            , about <span className="text-foreground font-semibold tabular-nums">{formatUsd(totals.cost)}</span>
          </>
        )}
        .
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <LegendItem color={PART_COLORS.input} label="Input" value={parts.input} />
        <LegendItem color={PART_COLORS.cached} label="Input from cache" value={parts.cached} />
        <LegendItem color={PART_COLORS.output} label="Output" value={parts.output} />
      </ul>
    </section>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={cn("size-2.5 rounded-[3px]", color)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatCompact(value)}</span>
    </li>
  );
}
