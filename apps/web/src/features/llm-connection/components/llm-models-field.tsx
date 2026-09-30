import { SchemaFormFields } from "@/components/schema-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ChevronUp, GripVertical, Info, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { useListLlmConnections, useLlmProviders, useProviderModels } from "../hooks";

import type { LlmCapability, LlmConnection, LlmProviderInfo } from "@snipet/shared";
import type { RJSFSchema } from "@rjsf/utils";
type Props = {
  /** Field-array path holding `ExecuteLlmTarget[]` (`ExecuteLlmTarget` in @snipet/shared). */
  name: string;
  /** If set, only models with these capabilities will be shown. */
  allowedModelCapabilities?: LlmCapability[];
};

// splitModelRef mirrors the backend's llm.SplitModelRef: "provider-key/model"
// split on the first "/". Either side empty (or no "/" at all) reads as "".
function splitModelRef(ref: string): [providerKey: string, modelKey: string] {
  const i = ref.indexOf("/");
  if (i <= 0) return ["", ""];
  return [ref.slice(0, i), ref.slice(i + 1)];
}

/**
 * Renders the top-to-bottom, drag-to-reorder list of LLM targets for a
 * generate/stream call: connection (grouped by provider), model, and — when the provider declares a
 * `generateExtraOptions` schema — a collapsible advanced-settings form for
 * it. Backed by `useFieldArray` at `name`, so the parent form owns the data.
 */
export function LlmModelsField({ name, allowedModelCapabilities }: Props) {
  const form = useFormContext();
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name });
  const { data: providers = [] } = useLlmProviders();
  const { data: connectionsPage } = useListLlmConnections();
  const connections = (connectionsPage?.data ?? []).filter((connection) => connection.enabled);
  const dragIndexRef = useRef<number | null>(null);

  // Keeps at least one row on screen so there's always something to fill in.
  useEffect(() => {
    if (fields.length === 0) append({ model: "" });
  }, [fields.length, append]);

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === index) return;
    move(from, index);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Models</CardTitle>
            <CardDescription>
              Tried top to bottom — if one errors, Snipet falls back to the next.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => append({ model: "" })}>
            <Plus />
            Add model
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              draggable
              onDragStart={() => (dragIndexRef.current = index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop(index)}
            >
              <LlmModelTargetRow
                name={name}
                index={index}
                providers={providers}
                connections={connections}
                total={fields.length}
                onRemove={() => remove(index)}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                allowedModelCapabilities={allowedModelCapabilities}
              />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Info className="size-3.5 shrink-0" />
          Order sets priority. Drag a model to change where it falls back to.
        </p>
      </CardFooter>
    </Card>
  );
}

type RowProps = {
  name: string;
  index: number;
  providers: LlmProviderInfo[];
  connections: LlmConnection[];
  allowedModelCapabilities?: LlmCapability[];
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function LlmModelTargetRow({ name, index, providers, connections, total, onRemove, onMoveUp, onMoveDown, allowedModelCapabilities }: RowProps) {
  const form = useFormContext();
  const fieldPath = `${name}.${index}`;
  const modelRef = (useWatch({ control: form.control, name: `${fieldPath}.model` }) as string | undefined) ?? "";
  const connectionId = useWatch({ control: form.control, name: `${fieldPath}.connectionId` }) as string | undefined;
  const [providerKey, modelKey] = splitModelRef(modelRef);
  const selectedProvider = providers.find((provider) => provider.key === providerKey);
  const { data: models = [], isLoading: isLoadingModels } = useProviderModels(providerKey, {
    searchParams: connectionId ? { connectionId } : undefined,
  });
  const groups = providers
    .map((provider) => ({ provider, items: connections.filter((connection) => connection.provider === provider.key) }))
    .filter((group) => group.items.length > 0);
  const filteredModels = allowedModelCapabilities
    ? models.filter((model) => allowedModelCapabilities.some((capability) => model.capabilities.includes(capability)))
    : models;
  const extraOptionsSchema = selectedProvider?.schemas.generateExtraOptions as RJSFSchema | undefined;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleConnectionChange = (nextConnectionId: string) => {
    const connection = connections.find((item) => item.id === nextConnectionId);
    if (!connection) return;
    form.setValue(`${fieldPath}.connectionId`, connection.id, { shouldDirty: true });
    form.setValue(`${fieldPath}.model`, `${connection.provider}/`, { shouldDirty: true, shouldTouch: true });
    form.setValue(`${fieldPath}.extraOptions`, undefined, { shouldDirty: true });
    setAdvancedOpen(false);
  };

  const handleModelChange = (nextModelKey: string) => {
    form.setValue(`${fieldPath}.model`, `${providerKey}/${nextModelKey}`, { shouldDirty: true, shouldTouch: true });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <GripVertical className="text-muted-foreground/60 size-4 shrink-0 cursor-grab" />
        <span className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
          {index + 1}
        </span>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={onMoveUp}>
          <ChevronUp />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={index === total - 1} onClick={onMoveDown}>
          <ChevronDown />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={total <= 1} onClick={onRemove}>
          <X />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={connectionId || undefined} onValueChange={handleConnectionChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a connection" />
          </SelectTrigger>
          <SelectContent>
            {groups.map(({ provider, items }) => (
              <SelectGroup key={provider.key}>
                <SelectLabel>{provider.name}</SelectLabel>
                {items.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select value={modelKey || undefined} onValueChange={handleModelChange} disabled={!connectionId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isLoadingModels ? "Loading…" : "Select a model"} />
          </SelectTrigger>
          <SelectContent>
            {filteredModels.map((model) => (
              <SelectItem key={model.key} value={model.key}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {extraOptionsSchema ? (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium"
            >
              <ChevronRight className={cn("size-3.5 transition-transform", advancedOpen && "rotate-90")} />
              Advanced settings
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="bg-background rounded-lg border p-3">
              <SchemaFormFields
                key={`${fieldPath}-${providerKey}-extra`}
                schema={extraOptionsSchema}
                defaultData={form.getValues(`${fieldPath}.extraOptions`)}
                onChange={(data) => form.setValue(`${fieldPath}.extraOptions`, data, { shouldDirty: true })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
