import http from "../http";
import { systemInfoSchema } from "@snipet/shared";

import type { SystemInfo } from "@snipet/shared";
import type { ServiceGetOptions } from "../http";

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
