import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useListMcpServers, useListPluginConnections, usePlugins } from "@snipet/client";
import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import type { AgentFormInput } from "../schemas";

type GrantsFieldProps = {
  name: "mcpServers" | "pluginConnections";
  idKey: "mcpServerId" | "pluginConnectionId";
  label: string;
  /** Singular, lowercase name of what is granted, e.g. "server". */
  noun: string;
  /** What the agent calls through a grant, e.g. "tools". */
  items: string;
  options: { label: string; value: string }[];
};

// A list of grants (an MCP server or plugin connection plus allow/deny globs
// on the tool/action name).
function AgentGrantsField({ name, idKey, label, noun, items, options }: GrantsFieldProps) {
  const form = useFormContext<AgentFormInput>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ [idKey]: "", allow: [], deny: [] } as never)}
        >
          <Plus />
          Grant {noun}
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">No {items}. Grant a {noun} to let the agent call its {items}.</p>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <FormSelect name={`${name}.${index}.${idKey}`} options={options} placeholder={`Select a ${noun}`} fieldclassname="flex-1" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${noun}`} onClick={() => remove(index)}>
                <X />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormInput name={`${name}.${index}.allow`} label="Allow" placeholder={`all ${items}`} split className="font-mono text-xs" />
              <FormInput name={`${name}.${index}.deny`} label="Deny" placeholder="list_*, *delete*" split className="font-mono text-xs" />
            </div>
          </div>
        ))
      )}
      {fields.length > 0 && (
        <p className="text-muted-foreground text-xs">Comma-separated glob patterns on the {items.replace(/s$/, "")} name. Deny wins over allow.</p>
      )}
    </div>
  );
}

export function AgentMcpServersField() {
  const { data } = useListMcpServers({ searchParams: { take: 500 } });
  const options = (data?.data ?? []).map((server) => ({ label: server.name, value: server.id }));
  return (
    <AgentGrantsField name="mcpServers" idKey="mcpServerId" label="MCP servers" noun="server" items="tools" options={options} />
  );
}

export function AgentPluginConnectionsField() {
  const { data } = useListPluginConnections({ searchParams: { take: 500 } });
  const { data: plugins } = usePlugins();
  const pluginName = new Map(plugins?.map((p) => [p.key, p.name]));
  const options = (data?.data ?? []).map((conn) => ({
    label: `${pluginName.get(conn.pluginKey) ?? conn.pluginKey} / ${conn.name}`,
    value: conn.id,
  }));
  return (
    <AgentGrantsField
      name="pluginConnections"
      idKey="pluginConnectionId"
      label="Plugins"
      noun="connection"
      items="actions"
      options={options}
    />
  );
}
