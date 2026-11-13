import { cn } from "@/lib/utils";

import { HubGraph } from "./hub-graph";

import type { HubGraphVariant } from "./hub-graph";

type StatusScreenProps = {
  /** Which drawing of the Snipet hub sits beside the text. */
  variant: HubGraphVariant;
  title: string;
  description: React.ReactNode;
  /** Buttons under the text, primary first. */
  actions?: React.ReactNode;
  /** Extra content under the actions, such as error details. */
  children?: React.ReactNode;
  className?: string;
};

/** Full-area message for a screen with nothing else to show: a missing page, a crash or a stale build. */
export function StatusScreen({ variant, title, description, actions, children, className }: StatusScreenProps) {
  return (
    <main className={cn("flex min-h-0 flex-1 overflow-y-auto px-6 py-12", className)}>
      {/* m-auto centers while there's room and still scrolls from the top when details overflow. The drawing
          stays level with the title, so opening the stack trace doesn't leave it floating. */}
      <div className="m-auto flex w-full max-w-2xl flex-col items-start gap-8 sm:flex-row sm:gap-12">
        <HubGraph variant={variant} className="size-28 sm:size-48" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-6">
          <div className="space-y-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
            <div className="text-muted-foreground max-w-[60ch] text-[15px] leading-relaxed text-pretty">
              {description}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          {children}
        </div>
      </div>
    </main>
  );
}
