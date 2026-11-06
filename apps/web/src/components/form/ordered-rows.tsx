import { Button } from "@/components/ui/button";
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
  /** The row's own fields, placed between its number and its buttons. */
  children: (row: Row, index: number) => React.ReactNode;
};

/**
 * One-line rows whose order matters: drag handle, position, the row's fields,
 * then move and remove buttons. Below `sm` the fields drop to their own line.
 */
export function OrderedRows<Row extends { id: string }>({
  rows,
  rowLabel,
  onMove,
  onRemove,
  minRows = 0,
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
          className="flex flex-wrap items-start gap-x-2 gap-y-1 sm:flex-nowrap"
        >
          <div className="flex h-8 shrink-0 items-center gap-1.5">
            <GripVertical className="text-muted-foreground/60 size-4 cursor-grab" />
            <span className="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full text-[11px] font-medium">
              {index + 1}
            </span>
          </div>
          <div className="order-last flex w-full min-w-0 gap-2 sm:order-none sm:w-auto sm:flex-1">
            {children(row, index)}
          </div>
          <div className="ml-auto flex h-8 shrink-0 items-center">
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
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
