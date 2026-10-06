import type { ServiceGetOptions } from "../http"
import { useQuery } from "@tanstack/react-query";

import { getSystemInfo } from "./service";

import type { UseQueryResult } from "@tanstack/react-query";
import type { SystemInfo } from "@snipet/shared";

export const useGetSystemInfo = (opts?: ServiceGetOptions<SystemInfo>): UseQueryResult<SystemInfo> => {
  return useQuery({
    queryKey: ["system-info"],
    queryFn: () => getSystemInfo(opts),
  })
}