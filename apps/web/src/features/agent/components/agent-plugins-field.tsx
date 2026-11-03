import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { SchemaFormFields } from "@/components/schema-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useListPluginConnections, usePlugins } from "@snipet/client";
import { hookHandlersOf } from "@snipet/shared";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { describeHandler } from "@/features/plugin-connection/capabilities";

import type { RJSFSchema } from "@rjsf/utils";
import type { HookName, PluginConnection, PluginManifest } from "@snipet/shared";
import type { AgentFormInput } from "../schemas";

/**
 * Plugin connections granted to the agent, in order (the order its hooks run
 * in): allow/deny globs on the tool name, the optional hooks it runs, and
 * the agent's settings for the plugin.
 */
export function AgentPluginsField() {
  const form = useFormContext<AgentFormInput>();
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "pluginConnections" });
  const { data } = useListPluginConnections({ searchParams: { take: 500 } });
  const { data: plugins } = usePlugins();
  const manifestOf = new Map(plugins?.map((p) => [p.key, p]));
  const connections = data?.data ?? [];
  const options = connections.map((conn) => ({
    label: `${manifestOf.get(conn.pluginKey)?.name ?? conn.pluginKey} / ${conn.name}`,
    value: conn.id,
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Plugins</Label>
        <Button
          type="button"
          size="sm"
          onClick={() => append({ pluginConnectionId: "", allow: [], deny: [], settings: {}, disabledHooks: [] })}
        >
          <Plus />
          Add plugin
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">No plugins. Add a connection to give the agent its tools and hooks.</p>
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
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => move(index, index - 1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove plugin" onClick={() => remove(index)}>
                <X />
              </Button>
            </div>
            <PluginGrant index={index} connections={connections} manifestOf={manifestOf} />
          </div>
        ))
      )}
      {fields.length > 1 && <p className="text-muted-foreground text-xs">Hooks run in this order.</p>}
    </div>
  );
}

/** The parts of a grant that depend on its plugin: allow/deny, hooks, settings. */
function PluginGrant({
  index,
  connections,
  manifestOf,
}: {
  index: number;
  connections: PluginConnection[];
  manifestOf: Map<string, PluginManifest>;
}) {
  const form = useFormContext<AgentFormInput>();
  const name = `pluginConnections.${index}` as const;
  const connectionId = useWatch({ control: form.control, name: `${name}.pluginConnectionId` });
  const disabledHooks = useWatch({ control: form.control, name: `${name}.disabledHooks` }) ?? [];
  const connection = connections.find((c) => c.id === connectionId);
  const manifest = connection && manifestOf.get(connection.pluginKey);
  if (!manifest) return null;

  const { tools, hooks } = manifest.capabilities;
  const settings = manifest.settings as RJSFSchema | undefined;
  const toggleHook = (hook: HookName, on: boolean) =>
    form.setValue(
      `${name}.disabledHooks`,
      on ? disabledHooks.filter((h) => h !== hook) : [...disabledHooks, hook],
      { shouldDirty: true },
    );

  return (
    <>
      {tools && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <FormInput name={`${name}.allow`} label="Allow" placeholder="all tools" split className="font-mono text-xs" />
            <FormInput name={`${name}.deny`} label="Deny" placeholder="list_*, *delete*" split className="font-mono text-xs" />
          </div>
          <p className="text-muted-foreground text-xs">Comma-separated glob patterns on the tool name. Deny wins over allow.</p>
        </>
      )}
      {hooks && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Hooks</p>
          {[...hookHandlersOf(hooks)].map(([hook, handler]) => (
            <label key={hook} className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={!handler.optional || !disabledHooks.includes(hook)}
                disabled={!handler.optional}
                onCheckedChange={(checked) => toggleHook(hook, checked === true)}
              />
              <code>{hook}</code>
              <span className="text-muted-foreground">{describeHandler(handler)}</span>
            </label>
          ))}
        </div>
      )}
      {settings && Object.keys(settings.properties ?? {}).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Settings</p>
          <SchemaFormFields
            // A new connection gets fresh fields: defaultData is only read on mount.
            key={connectionId}
            schema={settings}
            defaultData={form.getValues(`${name}.settings`)}
            onChange={(data) => form.setValue(`${name}.settings`, data, { shouldDirty: true })}
          />
        </div>
      )}
    </>
  );
}
