import { useGetSystemInfo } from "@/features/system/hooks";

import { Loading } from "./ui/loading";

export const Version = () => {
  const { data, error, isLoading } = useGetSystemInfo()

  if (error) return <span className="text-destructive text-sm">Error</span>

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">Version:</span>
      {
        isLoading ? (
          <Loading variant="skeleton" count={1} width="w-10" height="h-4" className="m-0" />
        ) : (
          <span className="text-xs font-medium tabular-nums">{data?.version}</span>
        )
      }
    </div>
  )
}