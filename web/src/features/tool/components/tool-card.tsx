import { cn } from "@/lib/utils";

import { toolParameters } from "../lib/input-schema";

import { ToolIcon } from "./tool-icon";

import type { Tool } from "../schemas";

const MAX_VISIBLE_PARAMS = 4;

type Props = {
  tool: Tool;
  serverIcon?: string;
  onSelect: (tool: Tool) => void;
};

export function ToolCard({ tool, serverIcon, onSelect }: Props) {
  const params = toolParameters(tool.input_schema);
  const visible = params.slice(0, MAX_VISIBLE_PARAMS);
  const hidden = params.length - visible.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      className={cn(
        "group bg-card text-card-foreground flex h-full w-full flex-col gap-3 rounded-xl border p-4 text-left",
        "hover:border-primary/40 transition-all hover:shadow-sm",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
      )}
    >
      <div className="flex items-start gap-3">
        <ToolIcon tool={tool} serverIcon={serverIcon} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold" title={tool.name}>{tool.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {tool.mcp_server ? tool.mcp_server.name : "Built-in"}
          </p>
        </div>
        <span className="text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          {tool.source}
        </span>
      </div>

      <p className="text-muted-foreground line-clamp-2 min-h-8 text-xs leading-4">
        {tool.description || <span className="italic">No description</span>}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1 border-t pt-3">
        {params.length === 0 && <span className="text-muted-foreground text-[11px]">No parameters</span>}
        {visible.map((param) => (
          <span
            key={param.name}
            title={param.required ? `${param.name} (required)` : param.name}
            className="bg-muted/60 inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
          >
            {param.required && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
            {param.name}
          </span>
        ))}
        {hidden > 0 && <span className="text-muted-foreground px-1 text-[11px]">+{hidden} more</span>}
      </div>
    </button>
  );
}
