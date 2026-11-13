import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useState } from "react";

import { formatCompact, formatDay, formatUsd, formatWhole, PART_COLORS, tokenParts, totalTokens } from "../lib";

import type { UsageReportRow } from "@snipet/shared";

type DailyChartProps = {
  days: { day: string; row: UsageReportRow | undefined }[];
  /** True while a new period or agent loads; the old bars stay, dimmed. */
  isStale: boolean;
  selectedDay: string | undefined;
  /** Called with undefined when the selected day is picked again. */
  onSelectDay: (day: string | undefined) => void;
};

const GROW = { duration: 0.7, ease: [0.22, 1, 0.36, 1] } as const;

/** Tokens per day, each bar split into cached input, input and output. Bars grow in once, then morph; picking one opens its day. */
export function DailyChart({ days, isStale, selectedDay, onSelectDay }: DailyChartProps) {
  const max = Math.max(1, ...days.map(({ row }) => totalTokens(row)));
  const busiest = days.reduce((best, entry) => (totalTokens(entry.row) > totalTokens(best.row) ? entry : best));
  // The staggered grow-in plays once, until the last bar is up; later changes morph together.
  const [hasGrown, setHasGrown] = useState(false);

  const label = `Tokens per day. Busiest: ${formatDay(busiest.day)}, ${formatWhole(totalTokens(busiest.row))} tokens.`;
  const middle = days[Math.floor(days.length / 2)];

  return (
    <figure className="space-y-2">
      <div className="text-muted-foreground flex items-baseline justify-between text-xs tabular-nums">
        <span>
          {selectedDay
            ? "Tokens per day. Pick the day again to close it."
            : "Tokens per day. Pick a day to see its calls."}
        </span>
        <span>{formatCompact(max)} max</span>
      </div>
      <div
        role="group"
        aria-label={label}
        className={cn(
          "relative flex h-48 items-end gap-px border-b transition-opacity duration-300 sm:h-60 sm:gap-1",
          isStale && "opacity-50",
        )}
      >
        {/* Half-way guide, so a bar's height can be read without hovering. */}
        <div
          aria-hidden
          className="border-border/70 pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed"
        />
        {days.map(({ day, row }, index) => {
          const parts = tokenParts(row);
          const total = totalTokens(row);
          const isSelected = day === selectedDay;
          return (
            <Tooltip key={day} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${formatDay(day)}, ${formatWhole(total)} tokens`}
                  aria-pressed={isSelected}
                  // aria-disabled, not disabled: a disabled button gets no hover, so its "No calls" tooltip wouldn't show.
                  aria-disabled={total === 0}
                  onClick={() => total > 0 && onSelectDay(isSelected ? undefined : day)}
                  className={cn(
                    "group flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-[3px] outline-none transition-opacity",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 aria-disabled:cursor-default",
                    selectedDay && !isSelected && "opacity-35 hover:opacity-70",
                  )}
                >
                  <motion.span
                    initial={{ height: 0 }}
                    animate={{ height: `${(total / max) * 100}%` }}
                    transition={{ ...GROW, delay: hasGrown ? 0 : index * (0.5 / days.length) }}
                    onAnimationComplete={index === days.length - 1 ? () => setHasGrown(true) : undefined}
                    className="flex flex-col overflow-hidden rounded-t-[3px] transition-[filter] group-hover:brightness-110"
                  >
                    <span className={PART_COLORS.output} style={{ flexGrow: parts.output }} />
                    <span className={PART_COLORS.input} style={{ flexGrow: parts.input }} />
                    <span className={PART_COLORS.cached} style={{ flexGrow: parts.cached }} />
                  </motion.span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="w-max space-y-2.5 px-3.5 py-3 whitespace-nowrap">
                <div className="flex items-baseline justify-between gap-6">
                  <p className="font-semibold">{formatDay(day)}</p>
                  {row?.cost != null && <p className="font-semibold tabular-nums">{formatUsd(row.cost)}</p>}
                </div>
                {total === 0 ? (
                  <p className="text-muted-foreground text-xs">No calls</p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {formatCompact(total)} tokens in {formatWhole(row?.calls ?? 0)}{" "}
                      {row?.calls === 1 ? "call" : "calls"}
                    </p>
                    {/* Same order and colors as the bar, top to bottom. */}
                    <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                      <TooltipPart color={PART_COLORS.output} label="Output" value={parts.output} />
                      <TooltipPart color={PART_COLORS.input} label="Input" value={parts.input} />
                      <TooltipPart color={PART_COLORS.cached} label="Input from cache" value={parts.cached} />
                    </dl>
                  </>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <figcaption className="text-muted-foreground flex justify-between text-xs">
        <span>{formatDay(days[0].day)}</span>
        <span className="hidden sm:inline">{formatDay(middle.day)}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}

/** One part of the bar in its tooltip: the bar's color, the name and the tokens, exact on hover. */
function TooltipPart({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    // A div per pair keeps the dl valid; "contents" lets its children sit on the parent grid.
    <div className="contents">
      <span aria-hidden className={cn("size-2 rounded-[2px]", color)} />
      <dt className="text-muted-foreground pr-4">{label}</dt>
      <dd className="text-right font-medium" title={`${formatWhole(value)} tokens`}>
        {formatCompact(value)}
      </dd>
    </div>
  );
}
