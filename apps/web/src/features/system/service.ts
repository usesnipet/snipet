import http from "@/lib/http";
import { systemInfoSchema } from "@snipet/shared";

import type { SystemInfo } from "@snipet/shared";
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
