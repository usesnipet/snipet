import { OrderedRows } from "@/components/form/ordered-rows";
import { FormSelect } from "@/components/form/select";
import { SchemaFormFields } from "@/components/schema-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { syncState, useListPluginConnections, usePluginConnectionTools, usePlugins } from "@snipet/client";
import { hookHandlersOf } from "@snipet/shared";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { describeHandler } from "@/features/plugin-connection/capabilities";

import type { RJSFSchema } from "@rjsf/utils";
import type { HookName, PluginConnection, PluginManifest, PluginTool } from "@snipet/shared";
import type { AgentFormInput } from "../schemas";

/** Form path of one plugin grant. */
type GrantPath = `pluginConnections.${number}`;

/** Neutral when checked: a long list in the accent color outweighs the dialog's action. */
const QUIET_CHECKBOX_CLASS =
  "rounded-sm data-[state=checked]:border-input data-[state=checked]:bg-transparent data-[state=checked]:text-foreground dark:data-[state=checked]:bg-input/30";

/**
 * Plugin connections granted to the agent, in order (the order its hooks run
 * in). Each row picks the connection; Configure opens its tools, optional hooks
 * and the agent's settings for the plugin.
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
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Plugins</h2>
        <p className="text-muted-foreground text-sm">Tools and hooks the agent can use. Hooks run in this order.</p>
      </div>
      {fields.length > 0 && (
        <OrderedRows rows={fields} rowLabel="plugin" onMove={move} onRemove={remove}>
          {(_field, index) => (
            <PluginRow index={index} options={options} connections={connections} manifestOf={manifestOf} />
          )}
        </OrderedRows>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("text-muted-foreground", fields.length > 0 && "sm:ml-12.5")}
        onClick={() => append({ pluginConnectionId: "", settings: {}, disabledHooks: [] })}
      >
        <Plus />
        Add plugin
      </Button>
    </section>
  );
}

function PluginRow({
  index,
  options,
  connections,
  manifestOf,
}: {
  index: number;
  options: { label: string; value: string }[];
  connections: PluginConnection[];
  manifestOf: Map<string, PluginManifest>;
}) {
  const form = useFormContext<AgentFormInput>();
  const name = `pluginConnections.${index}` as const;
  const connectionId = useWatch({ control: form.control, name: `${name}.pluginConnectionId` });
  const connection = connections.find((c) => c.id === connectionId);
  const manifest = connection && manifestOf.get(connection.pluginKey);

  return (
    <>
      <FormSelect
        name={`${name}.pluginConnectionId`}
        options={options}
        placeholder="Select a connection"
        fieldclassname="min-w-0 flex-1"
        onValueChange={() => {
          // Names of the previous connection's tools mean nothing on this one.
          form.setValue(`${name}.tools`, undefined);
          return undefined;
        }}
      />
      {connection && manifest ? (
        <PluginConfigure key={connection.id} name={name} connection={connection} manifest={manifest} />
      ) : (
        <Button type="button" variant="ghost" disabled>
          Configure
        </Button>
      )}
    </>
  );
}

/**
 * The Configure button and its dialog, whose edits go straight into the agent
 * form. Lives inside the row, even while closed, because a grant with no list
 * yet (undefined) must start with every tool on: the API saves undefined as none.
 */
function PluginConfigure({
  name,
  connection,
  manifest,
}: {
  name: GrantPath;
  connection: PluginConnection;
  manifest: PluginManifest;
}) {
  const form = useFormContext<AgentFormInput>();
  const { tools: hasTools, hooks } = manifest.capabilities;
  const settings = manifest.settings as RJSFSchema | undefined;
  const hasSettings = Object.keys(settings?.properties ?? {}).length > 0;
  const { data: tools } = usePluginConnectionTools(connection, { enabled: !!hasTools });
  const selected = useWatch({ control: form.control, name: `${name}.tools` });

  useEffect(() => {
    if (selected === undefined && tools?.length) {
      form.setValue(
        `${name}.tools`,
        tools.map((t) => t.name),
        { shouldDirty: true },
      );
    }
  }, [form, name, selected, tools]);

  if (!hasTools && !hooks && !hasSettings) {
    return (
      <Button type="button" variant="ghost" disabled title="This plugin has nothing to configure">
        Configure
      </Button>
    );
  }

  // Drops tools the connection no longer has, so they don't count or get saved again.
  const current = (selected ?? []).filter((toolName) => tools?.some((t) => t.name === toolName));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost">
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure {connection.name}</DialogTitle>
          <DialogDescription>Choose what this agent can use. Changes apply when you save the agent.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-1">
          {hasTools && <ToolPicker name={name} connection={connection} tools={tools} current={current} />}
          {hooks && <HookList name={name} hooks={hooks} />}
          {hasSettings && settings && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Settings</p>
              <SchemaFormFields
                schema={settings}
                defaultData={form.getValues(`${name}.settings`)}
                onChange={(data) => form.setValue(`${name}.settings`, data, { shouldDirty: true })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Checklist of the connection's tools. */
function ToolPicker({
  name,
  connection,
  tools,
  current,
}: {
  name: GrantPath;
  connection: PluginConnection;
  tools: PluginTool[] | undefined;
  /** Names of the tools currently on. */
  current: string[];
}) {
  const form = useFormContext<AgentFormInput>();
  const [search, setSearch] = useState("");

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
  const setTools = (next: string[]) => form.setValue(`${name}.tools`, next, { shouldDirty: true });
  const query = search.trim().toLowerCase();
  const visible = tools.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(query));

  return (
    <div>
      {/* Stays in view so the count and search remain reachable down a long list. */}
      <div className="bg-popover sticky top-0 z-10 space-y-1 pb-2">
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
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools"
            aria-label="Search tools"
          />
        )}
      </div>
      <div className="space-y-2">
        {visible.map((tool) => (
          <label key={tool.name} className="flex items-start gap-2">
            <Checkbox
              className={cn(QUIET_CHECKBOX_CLASS, "mt-0.5")}
              checked={current.includes(tool.name)}
              onCheckedChange={(checked) =>
                setTools(checked === true ? [...current, tool.name] : current.filter((n) => n !== tool.name))
              }
            />
            <span className="min-w-0">
              <code className="block text-xs break-all">{tool.name}</code>
              <span className="text-muted-foreground block text-xs">{tool.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** The plugin's hooks; only the optional ones can be turned off. */
function HookList({ name, hooks }: { name: GrantPath; hooks: NonNullable<PluginManifest["capabilities"]["hooks"]> }) {
  const form = useFormContext<AgentFormInput>();
  const disabledHooks = useWatch({ control: form.control, name: `${name}.disabledHooks` }) ?? [];
  const toggleHook = (hook: HookName, isOn: boolean) =>
    form.setValue(`${name}.disabledHooks`, isOn ? disabledHooks.filter((h) => h !== hook) : [...disabledHooks, hook], {
      shouldDirty: true,
    });

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Hooks</p>
      {[...hookHandlersOf(hooks)].map(([hook, handler]) => (
        <label key={hook} className="flex items-center gap-2 text-xs">
          <Checkbox
            className={QUIET_CHECKBOX_CLASS}
            checked={!handler.optional || !disabledHooks.includes(hook)}
            disabled={!handler.optional}
            onCheckedChange={(checked) => toggleHook(hook, checked === true)}
          />
          <code>{hook}</code>
          <span className="text-muted-foreground">{describeHandler(handler)}</span>
        </label>
      ))}
    </div>
  );
}
