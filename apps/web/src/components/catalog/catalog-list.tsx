import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

import type { VariantProps } from "class-variance-authority";
import { ScrollArea } from "../ui/scroll-area";

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
        <ul className={cn(catalogListVariants({ size, className }), "pb-1 pr-3")}>
          {items.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
