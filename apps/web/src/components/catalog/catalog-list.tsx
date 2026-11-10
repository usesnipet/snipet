import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import { AnimatePresence, motion } from "motion/react";

import type { VariantProps } from "class-variance-authority";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";

const catalogListVariants = cva("grid grid-cols-1 gap-4", {
  variants: {
    size: {
      sm: "sm:grid-cols-3 xl:grid-cols-4",
      md: "sm:grid-cols-2 xl:grid-cols-3",
      lg: "sm:grid-cols-1 xl:grid-cols-2",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

type CatalogListProps<T extends { id: string }> = VariantProps<typeof catalogListVariants> & {
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
  containerClassName?: string;
};

export function CatalogList<T extends { id: string }>({
  items,
  emptyMessage,
  renderItem,
  size,
  className,
  containerClassName,
}: CatalogListProps<T>) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    // The negative margin puts the scrollbar in the page's gutter, past the ul's padding, so cards align with the page.
    <div className={cn("-mr-3 min-h-0", containerClassName)}>
      {/* Radix wraps the content in a display:table that grows with it, which would stop long card text truncating. */}
      <ScrollArea className="h-full [&>[data-radix-scroll-area-viewport]>div]:block!">
        {/* Searching, filtering or sorting: leaving cards fade out, the rest slide to their new cells. */}
        <ul className={cn(catalogListVariants({ size, className }), "relative pb-1 pr-3")}>
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: transitions.fast }}
                transition={transitions.base}
              >
                {renderItem(item)}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </ScrollArea>
    </div>
  );
}

type CatalogListSkeletonProps = VariantProps<typeof catalogListVariants> & {
  /** How many placeholder cards; enough to fill the first screen. */
  count?: number;
  className?: string;
};

/**
 * Placeholder grid for a catalog that's loading: the same grid and card
 * padding as `CatalogList` and `CatalogCard`, so the real cards land in place.
 */
export function CatalogListSkeleton({ size, count = 6, className }: CatalogListSkeletonProps) {
  return (
    <div role="status" className={cn("min-h-0", className)}>
      <span className="sr-only">Loading</span>
      <ul aria-hidden className={cn(catalogListVariants({ size }), "pb-1")}>
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <Card className="flex h-full flex-col gap-0 p-5">
              {/* Sized like the real card (36px icon, two text-sm lines, small button), so cards don't grow on load. */}
              <div className="flex items-center gap-3 pb-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-2/3" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-24" />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
