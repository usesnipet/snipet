import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type JsonViewerProps = {
  value: unknown;
  title?: string;
  className?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-amber-700 dark:text-amber-400">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="tabular-nums text-sky-700 dark:text-sky-400">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="break-all text-foreground">{value || '""'}</span>;
  }
  return <span className="text-muted-foreground">{String(value)}</span>;
}

function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">[]</span>;
    }

    const allPrimitive = value.every(
      (item) => item === null || typeof item !== "object",
    );

    if (allPrimitive) {
      return (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <li
              key={index}
              className="rounded-md border bg-muted/40 px-2 py-0.5 text-sm"
            >
              <JsonPrimitive value={item} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">[{index}]</div>
            <div className={cn(depth > 0 && "border-l border-border pl-3")}>
              <JsonNode value={item} depth={depth + 1} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-muted-foreground italic">{"{}"}</span>;
    }

    return (
      <dl className="space-y-2.5">
        {entries.map(([key, nested]) => (
          <div key={key} className="space-y-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground">
              {key}
            </dt>
            <dd
              className={cn(
                "text-sm",
                (isPlainObject(nested) || Array.isArray(nested)) &&
                  depth >= 0 &&
                  "border-l border-border pl-3",
              )}
            >
              <JsonNode value={nested} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <JsonPrimitive value={value} />;
}

export function JsonViewer({ value, title, className }: JsonViewerProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {title ? (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={cn(!title && "pt-6")}>
        <JsonNode value={value} />
      </CardContent>
    </Card>
  );
}
