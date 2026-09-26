import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useListMcpServers } from "@/features/mcp-server/hooks";
import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import type { CreateAgentInput } from "../schemas";

export function AgentMcpServersField() {
  const form = useFormContext<CreateAgentInput>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "mcp_servers" });
  const { data } = useListMcpServers({ searchParams: { take: 500 } });
  const options = (data?.data ?? []).map((server) => ({ label: server.name, value: server.id }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>MCP servers</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ mcp_server_id: "", allow: [], deny: [] })}>
          <Plus />
          Grant server
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">No tools. Grant a server to let the agent call its tools.</p>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <FormSelect name={`mcp_servers.${index}.mcp_server_id`} options={options} placeholder="Select a server" fieldclassname="flex-1" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove server" onClick={() => remove(index)}>
                <X />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormInput name={`mcp_servers.${index}.allow`} label="Allow" placeholder="all tools" split className="font-mono text-xs" />
              <FormInput name={`mcp_servers.${index}.deny`} label="Deny" placeholder="list_*, *delete*" split className="font-mono text-xs" />
            </div>
          </div>
        ))
      )}
      {fields.length > 0 && (
        <p className="text-muted-foreground text-xs">Comma-separated glob patterns on the tool name. Deny wins over allow.</p>
      )}
    </div>
  );
}
