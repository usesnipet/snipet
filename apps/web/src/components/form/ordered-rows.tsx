import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { useRef } from "react";

type Props<Row extends { id: string }> = {
  rows: Row[];
  /** Names a row in the buttons' accessible labels, e.g. "model". */
  rowLabel: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  /** At this many rows, removing is disabled. */
  minRows?: number;
  /** Draws the rows as a chain, for lists where each one takes over from the one before. */
  chained?: boolean;
  /** The row's own fields, placed between its number and its buttons. */
  children: (row: Row, index: number) => React.ReactNode;
};

/**
 * One-line rows whose order matters: drag handle, position, the row's fields,
 * then move and remove buttons. Below `sm` the fields drop to their own line.
 * With a mouse the move buttons wait for hover or focus, so they don't outweigh the fields.
 */
export function OrderedRows<Row extends { id: string }>({
  rows,
  rowLabel,
  onMove,
  onRemove,
  minRows = 0,
  chained = false,
  children,
}: Props<Row>) {
  const dragIndexRef = useRef<number | null>(null);

  const handleDrop = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from !== null && from !== index) onMove(from, index);
  };

  return (
    <ol className="space-y-2">
      {rows.map((row, index) => (
        <li
          key={row.id}
          draggable
          onDragStart={() => (dragIndexRef.current = index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop(index)}
          className="group/row relative flex flex-wrap items-start gap-x-2 gap-y-1 sm:flex-nowrap"
        >
          {/* From this number down to the next; the fields take that spot below sm. */}
          {chained && index < rows.length - 1 && (
            <span aria-hidden className="bg-border absolute top-6.5 -bottom-3.5 left-8 hidden w-px sm:block" />
          )}
          <div className="flex h-8 shrink-0 items-center gap-1.5">
            <GripVertical className="text-muted-foreground/60 size-4 cursor-grab" />
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[11px] font-medium",
                chained && index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
          </div>
          <div className="order-last flex w-full min-w-0 gap-2 sm:order-none sm:w-auto sm:flex-1">
            {children(row, index)}
          </div>
          <div className="ml-auto flex h-8 shrink-0 items-center">
            <div className="flex transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${rowLabel} ${index + 1} up`}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${rowLabel} ${index + 1} down`}
                disabled={index === rows.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                <ChevronDown />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={`Remove ${rowLabel} ${index + 1}`}
              disabled={rows.length <= minRows}
              onClick={() => onRemove(index)}
            >
              <X />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
