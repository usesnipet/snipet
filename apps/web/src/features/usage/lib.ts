// TODO: refactor this file to be global for date, number, currency formatting
import type { UsageReportRow } from "@snipet/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The periods the page offers, in days. */
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/**
 * The last `days` UTC days, today included, as the report's from/to (to is exclusive).
 * Whole days, so the query key stays the same between renders.
 */
export function periodRange(days: Period): { from: Date; to: Date } {
  const now = new Date();
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return { from: new Date(tomorrow - days * DAY_MS), to: new Date(tomorrow) };
}

/** A UTC day (YYYY-MM-DD) as the report's from/to. */
export function dayRange(day: string): { from: Date; to: Date } {
  const start = new Date(`${day}T00:00:00Z`).getTime();
  return { from: new Date(start), to: new Date(start + DAY_MS) };
}

/** One bar per day of the period, a day without calls included; the report only has days with calls. */
export function fillDays(rows: UsageReportRow[], from: Date, days: Period) {
  const byDay = new Map(rows.map((row) => [row.key, row]));
  const start = from.getTime();
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start + index * DAY_MS).toISOString().slice(0, 10);
    return { day, row: byDay.get(day) };
  });
}

/** The three parts a bar is split in: cached input, the rest of the input, output. */
export function tokenParts(
  row: Pick<UsageReportRow, "inputTokens" | "outputTokens" | "cachedInputTokens"> | undefined,
) {
  const cached = row?.cachedInputTokens ?? 0;
  return { cached, input: (row?.inputTokens ?? 0) - cached, output: row?.outputTokens ?? 0 };
}

export const totalTokens = (row: Pick<UsageReportRow, "inputTokens" | "outputTokens"> | undefined) =>
  (row?.inputTokens ?? 0) + (row?.outputTokens ?? 0);

/** English like the rest of the app's copy, so "1.2M tokens" doesn't read "1,2 mi tokens". */
const LOCALE = "en-US";
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(LOCALE);
const usd = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
/** A call often costs a fraction of a cent, which two decimals would round to $0.00. */
const usdFine = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const time = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** 1.2M, 840K: for tokens, where the exact count is noise. */
export const formatCompact = (value: number) => compact.format(value);
export const formatWhole = (value: number) => whole.format(value);
export const formatUsd = (value: number) => usd.format(value);
export const formatUsdFine = (value: number) => usdFine.format(value);
/** "14:02:31", UTC like the days. */
export const formatTime = (date: Date) => time.format(date);

/** "Nov 3", read as UTC like the report's days. */
export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC" });

/** The colors of each part, shared by the legend and every bar. */
export const PART_COLORS = {
  cached: "bg-chart-4",
  input: "bg-chart-2",
  output: "bg-chart-1",
} as const;
