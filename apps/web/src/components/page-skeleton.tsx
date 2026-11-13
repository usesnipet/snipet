import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Stand-in for a page's body while it loads: a toolbar and a content block.
 * Generic on purpose, since the page's own code hasn't arrived yet.
 */
export function PageBodySkeleton({ className }: { className?: string }) {
  return (
    <div role="status" className={cn("flex min-h-0 flex-1 flex-col gap-5", className)}>
      <span className="sr-only">Loading</span>
      <Skeleton aria-hidden className="h-10 w-full shrink-0 sm:ml-auto sm:w-72" />
      <Skeleton aria-hidden className="min-h-48 flex-1 rounded-lg" />
    </div>
  );
}
