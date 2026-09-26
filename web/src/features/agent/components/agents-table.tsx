import { DeleteDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date";
import { useDialog } from "@/lib/dialog";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { useDeleteAgent, useListAgents } from "../hooks";

import { AgentFormDialog } from "./agent-form-dialog";

import type { Agent } from "../schemas";
import type { DataTableColumn, DataTablePagination } from "@/components/data-table";

function useAgentsListQuery(pagination: DataTablePagination) {
  return useListAgents({ searchParams: pagination });
}

function RowActions({ agent }: { agent: Agent }) {
  const { openDialog } = useDialog();
  const { mutateAsync: deleteAgent } = useDeleteAgent();

  const openDelete = () => openDialog({
    component: DeleteDialog,
    props: {
      title: "Delete agent?",
      description: (
        <>
          <span className="font-medium text-foreground">{agent.name}</span> and all of its sessions will be
          deleted. This action cannot be undone.
        </>
      ),
      onConfirm: () => deleteAgent(agent.id),
    },
  });

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Edit agent"
        onClick={() => openDialog({ component: AgentFormDialog, props: { agent } })}
      >
        <PencilIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete agent"
        onClick={openDelete}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

const columns: DataTableColumn<Agent>[] = [
  {
    id: "name",
    header: "Name",
    cell: (agent) => (
      <div>
        <p className="font-medium">{agent.name}</p>
        <p className="text-muted-foreground line-clamp-1 text-xs">{agent.description}</p>
      </div>
    ),
  },
  { id: "models", header: "Models", cell: (agent) => agent.llms?.length ?? 0 },
  { id: "servers", header: "MCP servers", cell: (agent) => agent.mcp_servers?.length ?? 0 },
  {
    id: "status",
    header: "Status",
    cell: (agent) => (
      <Badge variant={agent.enabled ? "default" : "secondary"}>{agent.enabled ? "Enabled" : "Disabled"}</Badge>
    ),
  },
  { id: "updated", header: "Updated", cell: (agent) => <DateFormat date={agent.updated_at} /> },
  {
    id: "actions",
    header: "",
    headerClassName: "w-0",
    className: "text-right",
    cell: (agent) => <RowActions agent={agent} />,
  },
];

export function AgentsTable() {
  return (
    <DataTable
      columns={columns}
      useQuery={useAgentsListQuery}
      getRowKey={(agent) => agent.id}
      emptyMessage="No agents yet."
    />
  );
}
