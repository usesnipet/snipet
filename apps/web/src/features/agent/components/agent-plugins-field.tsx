import { FormSelect } from "@/components/form/select";
import { SchemaFormFields } from "@/components/schema-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncState, useListPluginConnections, usePluginConnectionTools, usePlugins } from "@snipet/client";
import { hookHandlersOf } from "@snipet/shared";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { describeHandler } from "@/features/plugin-connection/capabilities";

import type { RJSFSchema } from "@rjsf/utils";
import type { HookName, PluginConnection, PluginManifest } from "@snipet/shared";
import type { AgentFormInput } from "../schemas";

/**
 * Plugin connections granted to the agent, in order (the order its hooks run
 * in): the tools it can call, the optional hooks it runs, and the agent's
 * settings for the plugin.
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
          onClick={() => append({ pluginConnectionId: "", settings: {}, disabledHooks: [] })}
        >
          <Plus />
          Add plugin
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No plugins. Add a connection to give the agent its tools and hooks.
        </p>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <FormSelect
                name={`pluginConnections.${index}.pluginConnectionId`}
                options={options}
                placeholder="Select a connection"
                fieldclassname="flex-1"
                onValueChange={() => {
                  // Names of the previous connection's tools mean nothing on this one.
                  form.setValue(`pluginConnections.${index}.tools`, undefined);
                  return undefined;
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move down"
                disabled={index === fields.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove plugin"
                onClick={() => remove(index)}
              >
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

/**
 * Checklist of the connection's tools. A grant with no list yet (undefined)
 * starts with every tool on, once they're synced; an empty list stays empty.
 */
function ToolPicker({ name, connection }: { name: `pluginConnections.${number}`; connection: PluginConnection }) {
  const form = useFormContext<AgentFormInput>();
  const selected = useWatch({ control: form.control, name: `${name}.tools` });
  const { data: tools } = usePluginConnectionTools(connection);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (selected === undefined && tools?.length) {
      form.setValue(
        `${name}.tools`,
        tools.map((t) => t.name),
        { shouldDirty: true },
      );
    }
  }, [form, name, selected, tools]);

  if (!tools?.length) {
    const sync = syncState(connection);
    return (
      <p className="text-muted-foreground text-xs">
        {sync.kind === "pending" && "Syncing tools…"}
        {sync.kind === "error" && `Couldn't list tools: ${sync.message}`}
        {sync.kind === "synced" && "This connection has no tools."}
      </p>
    );
  }

  const names = tools.map((t) => t.name);
  // Drops tools the connection no longer has, so they don't count or get saved again.
  const current = (selected ?? []).filter((n) => names.includes(n));
  const setTools = (next: string[]) => form.setValue(`${name}.tools`, next, { shouldDirty: true });
  const query = search.trim().toLowerCase();
  const visible = tools.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(query));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Tools ({current.length}/{tools.length})
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setTools(current.length === names.length ? [] : names)}
        >
          {current.length === names.length ? "Clear" : "Select all"}
        </Button>
      </div>
      {tools.length > 8 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools"
          aria-label="Search tools"
        />
      )}
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {visible.map((tool) => (
          <label key={tool.name} className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={current.includes(tool.name)}
              onCheckedChange={(checked) =>
                setTools(checked === true ? [...current, tool.name] : current.filter((n) => n !== tool.name))
              }
            />
            <code className="shrink-0">{tool.name}</code>
            <span className="truncate text-muted-foreground" title={tool.description}>
              {tool.description}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** The parts of a grant that depend on its plugin: tools, hooks, settings. */
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
    form.setValue(`${name}.disabledHooks`, on ? disabledHooks.filter((h) => h !== hook) : [...disabledHooks, hook], {
      shouldDirty: true,
    });

  return (
    <>
      {tools && connection && <ToolPicker key={connection.id} name={name} connection={connection} />}
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
