import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wrench } from "lucide-react";

import type { McpServer } from "../schemas";
import type { Tool } from "@/models/tool";
import type { DialogInstanceProps } from "@/lib/dialog";

type McpServerToolsDialogProps = DialogInstanceProps<{
  server: McpServer;
  tools: Tool[];
}>;

export function McpServerToolsDialog({ server, tools }: McpServerToolsDialogProps) {
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Tools from {server.name}</DialogTitle>
        <DialogDescription>
          {tools.length
            ? `${tools.length} tool${tools.length === 1 ? "" : "s"} your agents can call through this server.`
            : "No tools yet — they show up here once the server has synced."}
        </DialogDescription>
      </DialogHeader>
      {tools.length > 0 && (
        <ScrollArea className="max-h-[60vh]">
          <ul className="flex flex-col gap-2 pr-3">
            {tools.map((tool) => (
              <li key={tool.id} className="flex gap-2.5 rounded-lg border bg-muted/30 p-3">
                <Wrench className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-xs font-medium">{tool.name}</p>
                  {tool.description && <p className="text-muted-foreground text-xs">{tool.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}
