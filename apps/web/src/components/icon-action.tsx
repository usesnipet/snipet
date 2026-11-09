import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ReactNode } from "react";

/** Tooltip for an icon-only button; the button keeps its own aria-label. */
export function IconAction({ tooltip, children }: { tooltip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
