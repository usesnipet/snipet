import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import moment from "moment";
import { AnimatePresence, motion } from "motion/react";

import type { SyncState } from "@snipet/client";

/** Crossfades when the state changes (pending to synced, synced to error), so the change gets noticed. */
export function SyncStatus({ sync }: { sync: SyncState }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={sync.kind}
        className="flex min-w-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transitions.fast}
      >
        <SyncStatusContent sync={sync} />
      </motion.span>
    </AnimatePresence>
  );
}

function SyncStatusContent({ sync }: { sync: SyncState }) {
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
