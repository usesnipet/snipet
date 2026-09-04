import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

import type { VariantProps } from "class-variance-authority";
import { ScrollArea } from "../ui/scroll-area";

const catalogListVariants = cva(
  "grid gap-4",
  {
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
  }
)

type CatalogListProps<T extends { id: string }> = VariantProps<typeof catalogListVariants> &  {
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
    <div className={cn(containerClassName)}>
      <ScrollArea>
        <ul className={cn(catalogListVariants({ size, className }))}>
            {items.map((item) => (
              <li key={item.id}>{renderItem(item)}</li>
            ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
