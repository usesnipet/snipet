import { ExperimentalBadge } from "@/components/experimental-badge";
import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { FormSwitch } from "@/components/form/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { useHookManifests, useListHookConnections } from "@snipet/client";
import { DEFAULT_ASYNC_HOOK_TIMEOUT_MS, DEFAULT_SYNC_HOOK_TIMEOUT_MS, HOOKS, hookNameSchema } from "@snipet/shared";
import { ChevronRight, Plus, X } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import type { HookMatchKey, HookName, HookOnError } from "@snipet/shared";
import type { AgentFormInput } from "../schemas";

/** Hook names grouped by their prefix ("run", "tool", …), in catalog order. */
const HOOK_GROUPS: [group: string, events: HookName[]][] = [
  ...hookNameSchema.options
    .reduce((groups, hookName) => {
      const group = hookName.split(".")[0];
      groups.set(group, [...(groups.get(group) ?? []), hookName]);
      return groups;
    }, new Map<string, HookName[]>())
    .entries(),
];

const ON_ERROR_OPTIONS: { label: string; value: HookOnError }[] = [
  { label: "Continue", value: "continue" },
  { label: "Block the step", value: "fail" },
];

/** Label and placeholder of each match filter input. */
const MATCH_FIELDS: Record<HookMatchKey, { label: string; placeholder: string }> = {
  tools: { label: "Tools", placeholder: "all, or github_*" },
  models: { label: "Models", placeholder: "all, or openai/*" },
};

/** A new hook's settings, besides its event and async flag. */
const NEW_HOOK_DEFAULTS = {
  hookConnectionId: "",
  stage: 0,
  match: {},
  timeoutMs: null,
  onError: "continue",
  enabled: true,
} as const satisfies Partial<AgentFormInput["hooks"][number]>;

/** Whether handlers of the event can only observe: their reply is ignored. */
const isObserveOnly = (event: HookName): boolean => HOOKS[event].actions.length === 0;

type ConnectionOption = { label: string; value: string };

/** The agent's hooks as a tree of loop events, each with its pipeline of hook connections. */
export function AgentHooksField() {
  const form = useFormContext<AgentFormInput>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "hooks" });
  // fields only hold the values at append; stage and async change after.
  const hookValues = useWatch({ control: form.control, name: "hooks" }) ?? [];
  const { data: connectionPage } = useListHookConnections({ searchParams: { take: 500 } });
  const { data: manifests } = useHookManifests();
  const manifestNameByKey = new Map(manifests?.map((manifest) => [manifest.key, manifest.name]));
  const connectionOptions: ConnectionOption[] = (connectionPage?.data ?? []).map((connection) => ({
    label: `${manifestNameByKey.get(connection.hookKey) ?? connection.hookKey} / ${connection.name}`,
    value: connection.id,
  }));

  const addHook = (event: HookName): void => append({ ...NEW_HOOK_DEFAULTS, event, async: isObserveOnly(event) });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Hooks</Label>
        <ExperimentalBadge />
      </div>
      <div className="space-y-3">
        {HOOK_GROUPS.map(([group, events]) => (
          <div key={group}>
            <p className="text-muted-foreground mb-1 text-xs capitalize">{group}</p>
            {events.map((event) => {
              const indexes = fields.flatMap((field, index) => (field.event === event ? [index] : []));
              return (
                <HookEventNode
                  key={event}
                  event={event}
                  indexes={indexes}
                  hookValues={hookValues}
                  connectionOptions={connectionOptions}
                  onAdd={() => addHook(event)}
                  onRemove={remove}
                  keyOf={(index) => fields[index].id}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Global hooks run first. Synchronous hooks run stage by stage, each getting what the last left; hooks in the same
        stage run in parallel and can only block. Async ones get the final payload and don't hold the run.
      </p>
    </div>
  );
}

/** One event of the tree: its hooks, grouped by stage. */
function HookEventNode({
  event,
  indexes,
  hookValues,
  connectionOptions,
  onAdd,
  onRemove,
  keyOf,
}: {
  event: HookName;
  indexes: number[];
  hookValues: AgentFormInput["hooks"];
  connectionOptions: ConnectionOption[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  keyOf: (index: number) => string;
}) {
  const stageOf = (index: number): number => Number(hookValues[index]?.stage) || 0;
  const syncIndexes = indexes.filter((index) => !hookValues[index]?.async);
  const asyncIndexes = indexes.filter((index) => hookValues[index]?.async);
  const stages = [...new Set(syncIndexes.map(stageOf))].sort((left, right) => left - right);
  const renderCard = (index: number) => (
    <HookCard
      key={keyOf(index)}
      index={index}
      event={event}
      connectionOptions={connectionOptions}
      onRemove={() => onRemove(index)}
    />
  );

  return (
    <Collapsible defaultOpen={indexes.length > 0} className="group/event">
      <div className="flex items-center gap-1">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="flex-1 justify-start gap-2 font-mono text-xs">
            <ChevronRight className="transition-transform group-data-[state=open]/event:rotate-90" />
            {event}
            {indexes.length > 0 && <Badge variant="secondary">{indexes.length}</Badge>}
            {isObserveOnly(event) && <span className="text-muted-foreground font-sans">observe</span>}
          </Button>
        </CollapsibleTrigger>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Add hook on ${event}`} onClick={onAdd}>
          <Plus />
        </Button>
      </div>
      <CollapsibleContent className="space-y-2 border-l py-1 pl-3 ml-4">
        {indexes.length === 0 && <p className="text-muted-foreground text-xs">No hooks.</p>}
        {stages.map((stage) => {
          const inStage = syncIndexes.filter((index) => stageOf(index) === stage);
          return (
            <div key={stage} className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Stage {stage}
                {inStage.length > 1 && " · parallel, can only block"}
              </p>
              {inStage.map(renderCard)}
            </div>
          );
        })}
        {asyncIndexes.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Async</p>
            {asyncIndexes.map(renderCard)}
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
  connectionOptions,
  onRemove,
}: {
  index: number;
  event: HookName;
  connectionOptions: ConnectionOption[];
  onRemove: () => void;
}) {
  const isAsync = useWatch<AgentFormInput>({ name: `hooks.${index}.async` }) as boolean;
  const isAwaited = !isAsync && !isObserveOnly(event);
  const defaultTimeoutMs = isAwaited ? DEFAULT_SYNC_HOOK_TIMEOUT_MS : DEFAULT_ASYNC_HOOK_TIMEOUT_MS;
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start gap-2">
        <FormSelect
          name={`hooks.${index}.hookConnectionId`}
          options={connectionOptions}
          placeholder="Select a connection"
          fieldclassname="flex-1 min-w-0"
        />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove hook" onClick={onRemove}>
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isAwaited && <FormInput name={`hooks.${index}.stage`} label="Stage" inputMode="numeric" />}
        <FormInput
          name={`hooks.${index}.timeoutMs`}
          label="Timeout (ms)"
          inputMode="numeric"
          placeholder={`default ${defaultTimeoutMs}`}
        />
        {isAwaited && <FormSelect name={`hooks.${index}.onError`} label="On error" options={ON_ERROR_OPTIONS} />}
        {HOOKS[event].match.map((key) => (
          <FormInput
            key={key}
            name={`hooks.${index}.match.${key}`}
            label={MATCH_FIELDS[key].label}
            placeholder={MATCH_FIELDS[key].placeholder}
            split
            className="font-mono text-xs"
          />
        ))}
      </div>
      <div className="flex items-center gap-4">
        {!isObserveOnly(event) && <FormSwitch name={`hooks.${index}.async`} label="Async" />}
        <FormSwitch name={`hooks.${index}.enabled`} label="Enabled" />
      </div>
    </div>
  );
}
