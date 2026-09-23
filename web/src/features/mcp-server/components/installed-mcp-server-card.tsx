import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDialog } from "@/lib/dialog";
import { cn } from "@/lib/utils";
import { EllipsisVertical, Pencil, Trash, Wrench } from "lucide-react";
import moment from "moment";

import { describeConfig, syncState } from "../lib/config";

import { DeleteMcpServerDialog } from "./delete-mcp-server-dialog";
import { McpServerFormDialog } from "./mcp-server-form-dialog";
import { McpServerToolsDialog } from "./mcp-server-tools-dialog";

import type { McpServer, McpServerRegistryItem } from "../schemas";
import type { Tool } from "@/models/tool";
type Props = {
  server: McpServer;
  tools: Tool[];
  /** The registry entry this server was installed from, if any. */
  registryItem?: McpServerRegistryItem;
};

export function InstalledMcpServerCard({ server, tools, registryItem }: Props) {
  const { openDialog } = useDialog();
  const sync = syncState(server);

  const openTools = () => openDialog({ component: McpServerToolsDialog, props: { server, tools } });

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <Icon name={server.name} icon={registryItem?.icon} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold leading-tight">{server.name}</h2>
            <Badge variant="outline" className="text-muted-foreground font-normal">
              {server.transport === "http" ? "HTTP" : "stdio"}
            </Badge>
            {!registryItem && (
              <Badge variant="secondary" className="font-normal">Custom</Badge>
            )}
          </div>
          <code className="text-muted-foreground block truncate text-xs" title={describeConfig(server)}>
            {describeConfig(server)}
          </code>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${server.name}`}>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={openTools}>
              <Wrench /> View tools
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog({ component: McpServerFormDialog, props: { server } })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => openDialog({ component: DeleteMcpServerDialog, props: { server } })}
            >
              <Trash /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 text-xs">
        <SyncStatus sync={sync} />
        <Button variant="outline" size="sm" onClick={openTools} disabled={tools.length === 0}>
          <Wrench />
          {tools.length} tool{tools.length === 1 ? "" : "s"}
        </Button>
      </div>
    </Card>
  );
}

function SyncStatus({ sync }: { sync: ReturnType<typeof syncState> }) {
  const dot = (className: string) => <span className={cn("size-1.5 shrink-0 rounded-full", className)} />;

  if (sync.kind === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-destructive flex min-w-0 items-center gap-1.5">
            {dot("bg-destructive")}
            <span className="truncate">Sync failed: {sync.message}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">{sync.message}</TooltipContent>
      </Tooltip>
    );
  }
  if (sync.kind === "pending") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5">
        {dot("bg-amber-500 animate-pulse")}
        Waiting for first sync
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1.5" title={sync.at.toLocaleString()}>
      {dot("bg-emerald-500")}
      Synced {moment(sync.at).fromNow()}
    </span>
  );
}
