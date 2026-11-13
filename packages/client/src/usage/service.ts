import http from "../http";
import { usageCallSchema, usageCallsParamsSchema, usageReportParamsSchema, usageReportRowSchema } from "@snipet/shared";
import { z } from "zod";

import type { UsageCall, UsageCallsParams, UsageReportParams, UsageReportRow } from "@snipet/shared";
import type { ServiceGetOptions } from "../http";

const USAGE_URL = "/api/usage";

const report = async (opts: ServiceGetOptions<UsageReportRow[], UsageReportParams> = {}): Promise<UsageReportRow[]> =>
  http.get({
    url: USAGE_URL,
    schemas: { response: z.array(usageReportRowSchema), searchParams: usageReportParamsSchema },
    ...opts,
  });

const calls = async (opts: ServiceGetOptions<UsageCall[], UsageCallsParams> = {}): Promise<UsageCall[]> =>
  http.get({
    url: `${USAGE_URL}/calls`,
    schemas: { response: z.array(usageCallSchema), searchParams: usageCallsParamsSchema },
    ...opts,
  });

export const usageService = { report, calls };
