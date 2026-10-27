import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { FormSwitch } from "@/components/form/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { useHookManifests, useListHookConnections } from "@snipet/client";
import { HOOK_MODES, hookNameSchema } from "@snipet/shared";
import { ChevronDown, GripVertical, Plus, X } from "lucide-react";
import { useRef } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

import type { HookName } from "@snipet/shared";
import type { AgentFormInput } from "../schemas";

/** Hook names grouped by their prefix ("run", "tool", …), in catalog order. */
const HOOK_GROUPS = [
  ...hookNameSchema.options
    .reduce((groups, name) => {
      const group = name.split(".")[0];
      groups.set(group, [...(groups.get(group) ?? []), name]);
      return groups;
    }, new Map<string, HookName[]>())
    .entries(),
];

const ON_ERROR_OPTIONS = [
  { label: "Continue", value: "continue" },
  { label: "Fail the step", value: "fail" },
];

/** Hook connections bound to the agent; they run top to bottom on every selected event. */
export function AgentHooksField() {
  const form = useFormContext<AgentFormInput>();
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "hooks" });
  const { data } = useListHookConnections({ searchParams: { take: 500 } });
  const { data: manifests } = useHookManifests();
  const dragIndexRef = useRef<number | null>(null);
  const hookName = new Map(manifests?.map((m) => [m.key, m.name]));
  const options = (data?.data ?? []).map((conn) => ({
    label: `${hookName.get(conn.hookKey) ?? conn.hookKey} / ${conn.name}`,
    value: conn.id,
  }));

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from !== null && from !== index) move(from, index);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Hooks</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            append({ hookConnectionId: "", hooks: [], timeoutMs: null, onError: "continue", async: false, enabled: true })
          }
        >
          <Plus />
          Add hook
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">No hooks. Add one to run a connection on loop events.</p>
      ) : (
        fields.map((field, index) => (
          <div
            key={field.id}
            draggable
            onDragStart={() => (dragIndexRef.current = index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop(index)}
            className="space-y-2 rounded-lg border bg-muted/30 p-3"
          >
            <div className="flex items-start gap-2">
              <GripVertical className="text-muted-foreground/60 mt-2.5 size-4 shrink-0 cursor-grab" />
              <FormSelect
                name={`hooks.${index}.hookConnectionId`}
                options={options}
                placeholder="Select a connection"
                fieldclassname="flex-1 min-w-0"
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove hook" onClick={() => remove(index)}>
                <X />
              </Button>
            </div>
            <HookEventsSelect name={`hooks.${index}.hooks`} />
            <div className="grid grid-cols-2 gap-2">
              <FormInput name={`hooks.${index}.timeoutMs`} label="Timeout (ms)" inputMode="numeric" placeholder="default" />
              <FormSelect name={`hooks.${index}.onError`} label="On error" options={ON_ERROR_OPTIONS} />
            </div>
            <div className="flex items-center gap-4">
              <FormSwitch name={`hooks.${index}.async`} label="Async" />
              <FormSwitch name={`hooks.${index}.enabled`} label="Enabled" />
            </div>
          </div>
        ))
      )}
      {fields.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Drag to reorder: hooks run top to bottom. Async ones don't wait for the reply.
        </p>
      )}
    </div>
  );
}

/** Multi-select of the events a hook fires on. */
function HookEventsSelect({ name }: { name: `hooks.${number}.hooks` }) {
  const form = useFormContext<AgentFormInput>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const selected = new Set(field.value);
        const toggle = (hook: HookName, on: boolean) =>
          field.onChange(hookNameSchema.options.filter((h) => (h === hook ? on : selected.has(h))));
        return (
          <FormItem>
            <DropdownMenu >
              <FormControl>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {selected.size === 0 ? "Select events" : [...selected].join(", ")}
                    </span>
                    <ChevronDown className="opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
              </FormControl>
              <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
                {HOOK_GROUPS.map(([group, hooks]) => (
                  <div key={group}>
                    <DropdownMenuLabel className="text-muted-foreground text-xs capitalize">{group}</DropdownMenuLabel>
                    {hooks.map((hook) => (
                      <DropdownMenuCheckboxItem
                        key={hook}
                        checked={selected.has(hook)}
                        onCheckedChange={(on) => toggle(hook, on)}
                        onSelect={(e) => e.preventDefault()}
                        className="justify-between font-mono text-xs"
                      >
                        {hook}
                        <span className="text-muted-foreground font-sans">{HOOK_MODES[hook]}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
