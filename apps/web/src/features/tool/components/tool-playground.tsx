import { SchemaFormFields } from "@/components/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useExecuteTool, useListTools } from "../hooks";

import type { Tool } from "../schemas";
import type { RJSFSchema } from "@rjsf/utils";

const BUILT_IN = "Built-in";

export function ToolPlayground() {
  const [params, setParams] = useSearchParams();
  const toolId = params.get("tool") ?? "";

  const toolsQuery = useListTools({ searchParams: { take: 500 } });
  const tool = toolsQuery.data?.data.find((t) => t.id === toolId);

  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [elapsedMs, setElapsedMs] = useState<number>();
  const execute = useExecuteTool();

  const groups = useMemo(() => {
    const byServer = new Map<string, Tool[]>();
    for (const t of toolsQuery.data?.data ?? []) {
      const key = t.mcp_server?.name ?? BUILT_IN;
      byServer.set(key, [...(byServer.get(key) ?? []), t]);
    }
    return Array.from(byServer.entries());
  }, [toolsQuery.data]);

  const selectTool = (id: string) => {
    setParams({ tool: id }, { replace: true });
    setArgs({});
    setElapsedMs(undefined);
    execute.reset();
  };

  const run = () => {
    if (!tool) return;
    const start = performance.now();
    execute.mutate(
      { id: tool.id, data: { arguments: args } },
      { onSettled: () => setElapsedMs(Math.round(performance.now() - start)) },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={toolId} onValueChange={selectTool}>
            <SelectTrigger aria-label="Tool">
              <SelectValue placeholder={toolsQuery.isLoading ? "Loading tools…" : "Select a tool"} />
            </SelectTrigger>
            <SelectContent>
              {groups.map(([server, tools]) => (
                <SelectGroup key={server}>
                  <SelectLabel>{server}</SelectLabel>
                  {tools.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="font-mono">{t.name}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {tool && (
            <>
              {tool.description && (
                <p className="text-muted-foreground whitespace-pre-wrap text-xs">{tool.description}</p>
              )}
              <SchemaFormFields
                key={tool.id}
                schema={tool.input_schema as RJSFSchema}
                onChange={setArgs}
              />
              <Button type="button" className="w-full" onClick={run} disabled={execute.isPending}>
                {execute.isPending ? <Spinner /> : <Play />} Run
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Result</CardTitle>
          {execute.data && (
            <div className="flex items-center gap-2">
              {elapsedMs !== undefined && (
                <span className="text-muted-foreground text-xs tabular-nums">{elapsedMs} ms</span>
              )}
              <Badge variant={execute.data.is_error ? "destructive" : "secondary"}>
                {execute.data.is_error ? "Error" : "Success"}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {execute.data ? (
            <pre className="bg-muted/40 max-h-[70vh] overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border p-4 font-mono text-xs leading-5">
              {formatContent(execute.data.content)}
            </pre>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-xs">
              {tool ? "Fill in the arguments and run the tool." : "Pick a tool to get started."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// formatContent pretty-prints content that is JSON and returns anything else as-is.
function formatContent(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}
