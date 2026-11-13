import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { usageService } from "./service";

import type { UsageCall, UsageCallsParams, UsageReportParams, UsageReportRow } from "@snipet/shared";
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

export const usageCallsQueryKey = (params: UsageCallsParams) => [BASE_QUERY_KEY, "calls", params] as const;
export const useUsageCalls = (params: UsageCallsParams): UseQueryResult<UsageCall[], Error> =>
  useQuery({
    queryKey: usageCallsQueryKey(params),
    queryFn: () => usageService.calls({ searchParams: params }),
    placeholderData: keepPreviousData,
  });
