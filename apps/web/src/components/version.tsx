import { useGetSystemInfo } from "@snipet/client";

import { Skeleton } from "./ui/skeleton";

export const Version = () => {
  const { data, error, isLoading } = useGetSystemInfo();

  if (error) return <span className="text-destructive text-sm">Error</span>;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">Version:</span>
      {isLoading ? (
        <Skeleton className="h-4 w-10" />
      ) : (
        <span className="text-xs font-medium tabular-nums">{data?.version}</span>
      )}
    </div>
  );
};
