import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { usageService } from "./service";

import type { UsageReportParams, UsageReportRow, UsageRun, UsageRunsParams } from "@snipet/shared";
import type { UseQueryResult } from "@tanstack/react-query";

const BASE_QUERY_KEY = "usage";

export const usageReportQueryKey = (params: UsageReportParams) => [BASE_QUERY_KEY, params] as const;
/** Keeps the previous report on screen while a new period or agent loads, so charts morph instead of blinking. */
export const useUsageReport = (params: UsageReportParams): UseQueryResult<UsageReportRow[], Error> =>
  useQuery({
    queryKey: usageReportQueryKey(params),
    queryFn: () => usageService.report({ searchParams: params }),
    placeholderData: keepPreviousData,
  });

export const usageRunsQueryKey = (params: UsageRunsParams) => [BASE_QUERY_KEY, "runs", params] as const;
export const useUsageRuns = (params: UsageRunsParams): UseQueryResult<UsageRun[], Error> =>
  useQuery({
    queryKey: usageRunsQueryKey(params),
    queryFn: () => usageService.runs({ searchParams: params }),
    placeholderData: keepPreviousData,
  });
