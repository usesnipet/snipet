import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import moment from "moment";

import type { SyncState } from "@snipet/client";

export function SyncStatus({ sync }: { sync: SyncState }) {
  const dot = (className: string) => <span className={cn("size-1.5 shrink-0 rounded-full", className)} />;

  if (sync.kind === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-destructive flex min-w-0 items-center gap-1.5">
            {dot("bg-destructive")}
            <span className="truncate">Sync failed: {sync.message}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">{sync.message}</TooltipContent>
      </Tooltip>
    );
  }
  if (sync.kind === "pending") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5">
        {dot("bg-amber-500 animate-pulse")}
        Waiting for first sync
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1.5" title={sync.at.toLocaleString()}>
      {dot("bg-emerald-500")}
      Synced {moment(sync.at).fromNow()}
    </span>
  );
}
