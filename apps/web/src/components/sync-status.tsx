import { cn } from "@/lib/utils";
import moment from "moment";

import type { SyncState } from "@snipet/client";

export function SyncStatus({ sync }: { sync: SyncState }) {
  const dot = (className: string) => <span className={cn("size-1.5 shrink-0 rounded-full", className)} />;

  if (sync.kind === "error") {
    return (
      <span className="text-destructive flex min-w-0 items-start gap-1.5" title={sync.message}>
        {dot("bg-destructive mt-1")}
        <span className="line-clamp-2 wrap-break-word">Sync failed: {sync.message}</span>
      </span>
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
