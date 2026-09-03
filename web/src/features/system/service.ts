import http from "@/lib/http";

import { systemInfoSchema } from "./schemas";

import type { SystemInfo } from "./schemas";
import type { ServiceGetOptions } from "@/lib/services";

const SYSTEM_URL = "/api/system";

export const getSystemInfo = async (opts?: ServiceGetOptions<SystemInfo>) => {
  return http.get({
    url: `${SYSTEM_URL}/info`,
    schemas: {
      response: systemInfoSchema,
    },
    ...opts,
  })
}
