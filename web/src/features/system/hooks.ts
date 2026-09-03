import type { ServiceGetOptions } from "@/lib/services"
import { useQuery } from "@tanstack/react-query";

import { getSystemInfo } from "./service";

import type { UseQueryResult } from "@tanstack/react-query";
import type { SystemInfo } from "./schemas";

export const useGetSystemInfo = (opts?: ServiceGetOptions<SystemInfo>): UseQueryResult<SystemInfo> => {
  return useQuery({
    queryKey: ["system-info"],
    queryFn: () => getSystemInfo(opts),
  })
}