import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  /** Noun for the range label, e.g. "tools". */
  itemLabel?: string;
  className?: string;
};

type PageSlot = number | "ellipsis-start" | "ellipsis-end";

// Always shows the first, last and the current page's neighbours, collapsing the rest.
function pageSlots(page: number, pageCount: number): PageSlot[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const start = Math.max(2, Math.min(page - 1, pageCount - 4));
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5));
  const slots: PageSlot[] = [1];
  if (start > 2) slots.push("ellipsis-start");
  for (let i = start; i <= end; i++) slots.push(i);
  if (end < pageCount - 1) slots.push("ellipsis-end");
  slots.push(pageCount);
  return slots;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  itemLabel = "items",
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-col items-center gap-3 sm:flex-row sm:justify-between", className)}
    >
      <p className="text-muted-foreground text-xs tabular-nums">
        {total === 0 ? `No ${itemLabel}` : (
          <>
            Showing <span className="text-foreground font-medium">{from}–{to}</span> of{" "}
            <span className="text-foreground font-medium">{total}</span> {itemLabel}
          </>
        )}
      </p>

      <div className="flex items-center gap-4">
        {pageSizeOptions && onPageSizeChange && (
          <div className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
            Per page
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          {pageSlots(page, pageCount).map((slot) =>
            typeof slot === "number" ? (
              <Button
                key={slot}
                variant={slot === page ? "outline" : "ghost"}
                size="icon-sm"
                aria-current={slot === page ? "page" : undefined}
                className={cn("tabular-nums", slot === page && "font-semibold")}
                onClick={() => onPageChange(slot)}
              >
                {slot}
              </Button>
            ) : (
              <span key={slot} className="text-muted-foreground w-7 text-center text-xs">…</span>
            ),
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
