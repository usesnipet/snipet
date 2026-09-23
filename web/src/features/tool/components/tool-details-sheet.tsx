import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useClipboard } from "@/hooks/use-clipboard";
import { ROUTES } from "@/routes";
import { Copy, Play } from "lucide-react";
import moment from "moment";

import { toolParameters } from "../lib/input-schema";

import { ToolIcon } from "./tool-icon";

import type { ToolParameter } from "../lib/input-schema";
import type { Tool } from "../schemas";

type Props = {
  tool: Tool | null;
  serverIcon?: string;
  onOpenChange: (open: boolean) => void;
};

export function ToolDetailsSheet({ tool, serverIcon, onOpenChange }: Props) {
  return (
    <Sheet open={!!tool} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {tool && <ToolDetails tool={tool} serverIcon={serverIcon} />}
      </SheetContent>
    </Sheet>
  );
}

function ToolDetails({ tool, serverIcon }: { tool: Tool; serverIcon?: string }) {
  const { copy } = useClipboard();
  const params = toolParameters(tool.input_schema);
  const schemaJson = JSON.stringify(tool.input_schema, null, 2);

  return (
    <>
      <SheetHeader className="space-y-3 border-b p-6 pr-12">
        <div className="flex items-center gap-3">
          <ToolIcon tool={tool} serverIcon={serverIcon} className="size-10" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-1 font-mono text-base">
              <span className="truncate">{tool.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Copy tool name"
                onClick={() => copy(tool.name, { successTitle: "Tool name copied" })}
              >
                <Copy />
              </Button>
            </SheetTitle>
            <p className="text-muted-foreground text-xs">
              {tool.mcp_server ? <>via <span className="text-foreground">{tool.mcp_server.name}</span></> : "Built-in tool"}
              {" · "}updated {moment(tool.updated_at).fromNow()}
            </p>
          </div>
        </div>
        <SheetDescription className="whitespace-pre-wrap">
          {tool.description || "No description."}
        </SheetDescription>
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href={`${ROUTES.toolPlayground}?tool=${tool.id}`}>
            <Play /> Open in playground
          </Link>
        </Button>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-6">
          <section className="space-y-3">
            <h3 className="flex items-baseline gap-2 text-sm font-semibold">
              Parameters
              <span className="text-muted-foreground text-xs font-normal tabular-nums">{params.length}</span>
            </h3>
            {params.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
                This tool takes no parameters.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {params.map((param) => <ParameterRow key={param.name} param={param} />)}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Input schema</h3>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => copy(schemaJson, { successTitle: "Schema copied" })}
              >
                <Copy /> Copy
              </Button>
            </div>
            <pre className="bg-muted/40 overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-5">
              {schemaJson}
            </pre>
          </section>
        </div>
      </ScrollArea>
    </>
  );
}

function ParameterRow({ param }: { param: ToolParameter }) {
  return (
    <li className="space-y-1.5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-sm font-semibold">{param.name}</code>
        <code className="text-muted-foreground text-xs">{param.type}</code>
        {param.required && (
          <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            required
          </span>
        )}
      </div>
      {param.description && <p className="text-muted-foreground text-xs">{param.description}</p>}
      {param.enum && (
        <div className="flex flex-wrap gap-1">
          {param.enum.map((value) => (
            <code key={String(value)} className="bg-muted rounded px-1.5 py-0.5 text-[11px]">
              {JSON.stringify(value)}
            </code>
          ))}
        </div>
      )}
      {param.default !== undefined && (
        <p className="text-muted-foreground text-xs">
          Default: <code className="text-foreground">{JSON.stringify(param.default)}</code>
        </p>
      )}
    </li>
  );
}
