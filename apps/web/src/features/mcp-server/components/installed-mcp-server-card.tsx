import { DeleteDialog } from "@/components/confirm-dialog";
import { SyncStatus } from "@/components/sync-status";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useDialog } from "@/lib/dialog";
import { EllipsisVertical, Pencil, Trash, Wrench } from "lucide-react";
import { McpTransport } from "@snipet/shared";

import { syncState, useDeleteMcpServer } from "@snipet/client";
import { describeConfig } from "../lib/config";

import { McpServerFormDialog } from "./mcp-server-form-dialog";
import { McpServerToolsDialog } from "./mcp-server-tools-dialog";

import type { McpServer, McpServerRegistryItem } from "@snipet/shared";
import type { Tool } from "@snipet/shared";
type Props = {
  server: McpServer;
  tools: Tool[];
  /** The registry entry this server was installed from, if any. */
  registryItem?: McpServerRegistryItem;
};

export function InstalledMcpServerCard({ server, tools, registryItem }: Props) {
  const { openDialog } = useDialog();
  const { mutateAsync: deleteServer } = useDeleteMcpServer();
  const sync = syncState(server);

  const openTools = () => openDialog({ component: McpServerToolsDialog, props: { server, tools } });
  const openDelete = () => openDialog({
    component: DeleteDialog,
    props: {
      title: "Remove MCP server?",
      description: (
        <>
          <span className="font-medium text-foreground">{server.name}</span> and the tools it
          provides will no longer be available to your agents. This action cannot be undone.
        </>
      ),
      confirmLabel: "Remove",
      onConfirm: () => deleteServer(server.id),
    },
  });

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <Icon name={server.name} icon={registryItem?.icon} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold leading-tight">{server.name}</h2>
            <Badge variant="outline" className="text-muted-foreground font-normal">
              {server.transport === McpTransport.HTTP ? "HTTP" : "stdio"}
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
              onSelect={openDelete}
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
