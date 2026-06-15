"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DurationSelectOption = {
  label: string;
  value: string;
  /**
   * Computes the expiration instant from a reference date.
   * Return `null` for options that never expire.
   */
  resolveExpiresAt?: (from?: Date) => string | null;
};

function addWeeks(from: Date, weeks: number): Date {
  const date = new Date(from);
  date.setDate(date.getDate() + weeks * 7);
  return date;
}

function addMonths(from: Date, months: number): Date {
  const date = new Date(from);
  date.setMonth(date.getMonth() + months);
  return date;
}

function addYears(from: Date, years: number): Date {
  const date = new Date(from);
  date.setFullYear(date.getFullYear() + years);
  return date;
}

const DEFAULT_DURATION_OPTIONS: DurationSelectOption[] = [
  {
    label: "1 week",
    value: "1w",
    resolveExpiresAt: (from = new Date()) => addWeeks(from, 1).toISOString(),
  },
  {
    label: "1 month",
    value: "1m",
    resolveExpiresAt: (from = new Date()) => addMonths(from, 1).toISOString(),
  },
  {
    label: "3 months",
    value: "3m",
    resolveExpiresAt: (from = new Date()) => addMonths(from, 3).toISOString(),
  },
  {
    label: "6 months",
    value: "6m",
    resolveExpiresAt: (from = new Date()) => addMonths(from, 6).toISOString(),
  },
  {
    label: "1 year",
    value: "1y",
    resolveExpiresAt: (from = new Date()) => addYears(from, 1).toISOString(),
  },
  {
    label: "Never",
    value: "never",
    resolveExpiresAt: () => null,
  },
];

export function resolveDurationExpiresAt(
  value: string | undefined,
  options: DurationSelectOption[] = DEFAULT_DURATION_OPTIONS,
  from?: Date,
): string | null {
  const option = options.find((item) => item.value === value);
  if (!option?.resolveExpiresAt) return null;
  return option.resolveExpiresAt(from);
}

export type DurationSelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  options?: DurationSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function DurationSelect({
  value,
  onValueChange,
  options = DEFAULT_DURATION_OPTIONS,
  placeholder = "Selecione a duração",
  disabled,
  className,
}: DurationSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
