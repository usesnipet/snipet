import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { FormSwitch } from "@/components/form/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { useHookManifests, useListHookConnections } from "@snipet/client";
import { HOOKS, hookNameSchema } from "@snipet/shared";
import { ChevronRight, Plus, X } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

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
  { label: "Block the step", value: "fail" },
];

/** Whether handlers of the event can only observe: their reply is ignored. */
const observeOnly = (event: HookName) => HOOKS[event].actions.length === 0;

type ConnectionOption = { label: string; value: string };

/** The agent's hooks as a tree of loop events, each with its pipeline of hook connections. */
export function AgentHooksField() {
  const form = useFormContext<AgentFormInput>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "hooks" });
  // fields only hold the values at append; stage and async change after.
  const values = useWatch({ control: form.control, name: "hooks" }) ?? [];
  const { data } = useListHookConnections({ searchParams: { take: 500 } });
  const { data: manifests } = useHookManifests();
  const hookName = new Map(manifests?.map((m) => [m.key, m.name]));
  const options = (data?.data ?? []).map((conn) => ({
    label: `${hookName.get(conn.hookKey) ?? conn.hookKey} / ${conn.name}`,
    value: conn.id,
  }));

  const add = (event: HookName) =>
    append({
      event,
      hookConnectionId: "",
      stage: 0,
      match: {},
      timeoutMs: null,
      onError: "continue",
      async: observeOnly(event),
      enabled: true,
    });

  return (
    <div className="space-y-2">
      <Label>Hooks</Label>
      <div className="space-y-3">
        {HOOK_GROUPS.map(([group, events]) => (
          <div key={group}>
            <p className="text-muted-foreground mb-1 text-xs capitalize">{group}</p>
            {events.map((event) => {
              const indexes = fields.flatMap((f, i) => (f.event === event ? [i] : []));
              return (
                <HookEventNode
                  key={event}
                  event={event}
                  indexes={indexes}
                  values={values}
                  options={options}
                  onAdd={() => add(event)}
                  onRemove={remove}
                  keyOf={(i) => fields[i].id}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Global hooks run first. Synchronous hooks run stage by stage, each getting what the last left; hooks in the
        same stage run in parallel and can only block. Async ones get the final payload and don't hold the run.
      </p>
    </div>
  );
}

/** One event of the tree: its hooks, grouped by stage. */
function HookEventNode({
  event,
  indexes,
  values,
  options,
  onAdd,
  onRemove,
  keyOf,
}: {
  event: HookName;
  indexes: number[];
  values: AgentFormInput["hooks"];
  options: ConnectionOption[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  keyOf: (index: number) => string;
}) {
  const sync = indexes.filter((i) => !values[i]?.async);
  const asyncs = indexes.filter((i) => values[i]?.async);
  const stages = [...new Set(sync.map((i) => Number(values[i]?.stage) || 0))].sort((a, b) => a - b);

  return (
    <Collapsible defaultOpen={indexes.length > 0} className="group/event">
      <div className="flex items-center gap-1">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="flex-1 justify-start gap-2 font-mono text-xs">
            <ChevronRight className="transition-transform group-data-[state=open]/event:rotate-90" />
            {event}
            {indexes.length > 0 && <Badge variant="secondary">{indexes.length}</Badge>}
            {observeOnly(event) && <span className="text-muted-foreground font-sans">observe</span>}
          </Button>
        </CollapsibleTrigger>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Add hook on ${event}`} onClick={onAdd}>
          <Plus />
        </Button>
      </div>
      <CollapsibleContent className="space-y-2 border-l py-1 pl-3 ml-4">
        {indexes.length === 0 && <p className="text-muted-foreground text-xs">No hooks.</p>}
        {stages.map((stage) => {
          const inStage = sync.filter((i) => (Number(values[i]?.stage) || 0) === stage);
          return (
            <div key={stage} className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Stage {stage}
                {inStage.length > 1 && " · parallel, can only block"}
              </p>
              {inStage.map((i) => (
                <HookCard key={keyOf(i)} index={i} event={event} options={options} onRemove={() => onRemove(i)} />
              ))}
            </div>
          );
        })}
        {asyncs.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Async</p>
            {asyncs.map((i) => (
              <HookCard key={keyOf(i)} index={i} event={event} options={options} onRemove={() => onRemove(i)} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** One hook connection on an event, with its settings and the filters the event supports. */
function HookCard({
  index,
  event,
  options,
  onRemove,
}: {
  index: number;
  event: HookName;
  options: ConnectionOption[];
  onRemove: () => void;
}) {
  const isAsync = useWatch<AgentFormInput>({ name: `hooks.${index}.async` });
  const waited = !isAsync && !observeOnly(event);
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start gap-2">
        <FormSelect
          name={`hooks.${index}.hookConnectionId`}
          options={options}
          placeholder="Select a connection"
          fieldclassname="flex-1 min-w-0"
        />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove hook" onClick={onRemove}>
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {waited && <FormInput name={`hooks.${index}.stage`} label="Stage" inputMode="numeric" />}
        <FormInput name={`hooks.${index}.timeoutMs`} label="Timeout (ms)" inputMode="numeric" placeholder="default" />
        {waited && <FormSelect name={`hooks.${index}.onError`} label="On error" options={ON_ERROR_OPTIONS} />}
        {HOOKS[event].match.map((key) => (
          <FormInput
            key={key}
            name={`hooks.${index}.match.${key}`}
            label={key === "tools" ? "Tools" : "Models"}
            placeholder={key === "tools" ? "all, or github_*" : "all, or openai/*"}
            split
            className="font-mono text-xs"
          />
        ))}
      </div>
      <div className="flex items-center gap-4">
        {!observeOnly(event) && <FormSwitch name={`hooks.${index}.async`} label="Async" />}
        <FormSwitch name={`hooks.${index}.enabled`} label="Enabled" />
      </div>
    </div>
  );
}
