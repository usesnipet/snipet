import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useListPluginConnections, usePlugins } from "@snipet/client";
import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import type { AgentFormInput } from "../schemas";

// Plugin connections granted to the agent, each with allow/deny globs on the
// action name.
export function AgentPluginsField() {
  const form = useFormContext<AgentFormInput>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "pluginConnections" });
  const { data } = useListPluginConnections({ searchParams: { take: 500 } });
  const { data: plugins } = usePlugins();
  const pluginName = new Map(plugins?.map((p) => [p.key, p.name]));
  const options = (data?.data ?? []).map((conn) => ({
    label: `${pluginName.get(conn.pluginKey) ?? conn.pluginKey} / ${conn.name}`,
    value: conn.id,
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Plugins</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ pluginConnectionId: "", allow: [], deny: [] })}
        >
          <Plus />
          Grant connection
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">No actions. Grant a connection to let the agent call its actions.</p>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <FormSelect
                name={`pluginConnections.${index}.pluginConnectionId`}
                options={options}
                placeholder="Select a connection"
                fieldclassname="flex-1"
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove connection" onClick={() => remove(index)}>
                <X />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormInput name={`pluginConnections.${index}.allow`} label="Allow" placeholder="all actions" split className="font-mono text-xs" />
              <FormInput name={`pluginConnections.${index}.deny`} label="Deny" placeholder="list_*, *delete*" split className="font-mono text-xs" />
            </div>
          </div>
        ))
      )}
      {fields.length > 0 && (
        <p className="text-muted-foreground text-xs">Comma-separated glob patterns on the action name. Deny wins over allow.</p>
      )}
    </div>
  );
}
