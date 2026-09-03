import { useGetSystemInfo } from "@/features/system/hooks";

import { Loading } from "./ui/loading";

export const Version = () => {
  const { data, error, isLoading } = useGetSystemInfo()

  if (error) return <span className="text-destructive text-sm">Error</span>

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">API version:</span>

      {
        isLoading ? (
          <Loading variant="skeleton" count={1} width="w-10" height="h-4" className="m-0" />
        ) : (
          <span className="text-sm text-muted-foreground font-medium tabular-nums">{data?.version}</span>
        )
      }
    </div>
  )
}