import http from "../http";
import { usageReportParamsSchema, usageReportRowSchema, usageRunSchema, usageRunsParamsSchema } from "@snipet/shared";
import { z } from "zod";

import type { UsageReportParams, UsageReportRow, UsageRun, UsageRunsParams } from "@snipet/shared";
import type { ServiceGetOptions } from "../http";

const USAGE_URL = "/api/usage";

const report = async (opts: ServiceGetOptions<UsageReportRow[], UsageReportParams> = {}): Promise<UsageReportRow[]> =>
  http.get({
    url: USAGE_URL,
    schemas: { response: z.array(usageReportRowSchema), searchParams: usageReportParamsSchema },
    ...opts,
  });

const runs = async (opts: ServiceGetOptions<UsageRun[], UsageRunsParams> = {}): Promise<UsageRun[]> =>
  http.get({
    url: `${USAGE_URL}/runs`,
    schemas: { response: z.array(usageRunSchema), searchParams: usageRunsParamsSchema },
    ...opts,
  });

export const usageService = { report, runs };
