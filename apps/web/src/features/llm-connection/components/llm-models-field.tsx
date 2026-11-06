import { OrderedRows } from "@/components/form/ordered-rows";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListLlmConnections, useLLMModels, useLLMs } from "@snipet/client";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useFormContext, useFormState, useWatch } from "react-hook-form";

import type { LlmCapability, LlmConnection, LlmManifest } from "@snipet/shared";
type Props = {
  /** Field-array path holding `ExecuteLlmTarget[]` (`ExecuteLlmTarget` in @snipet/shared). */
  name: string;
  /** If set, only models with these capabilities will be shown. */
  allowedModelCapabilities?: LlmCapability[];
};

/** Splits "llm-key/model" on the first "/", like the backend; a missing side reads as "". */
function splitModelRef(ref: string): [llmKey: string, modelKey: string] {
  const i = ref.indexOf("/");
  if (i <= 0) return ["", ""];
  return [ref.slice(0, i), ref.slice(i + 1)];
}

/**
 * Drag-to-reorder list of LLM targets (connection + model) tried in order by a
 * generate/stream call. Backed by `useFieldArray` at `name`, so the parent form
 * owns the data.
 */
export function LlmModelsField({ name, allowedModelCapabilities }: Props) {
  const form = useFormContext();
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name });
  const { data: llms = [] } = useLLMs();
  const { data: connectionsPage } = useListLlmConnections();
  const connections = (connectionsPage?.data ?? []).filter((connection) => connection.enabled);

  // Keeps at least one row on screen so there's always something to fill in.
  useEffect(() => {
    if (fields.length === 0) append({ model: "" });
  }, [fields.length, append]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>Models</Label>
          <p className="text-muted-foreground text-xs">
            Tried top to bottom — if one errors, Snipet falls back to the next.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ model: "" })}>
          <Plus />
          Add model
        </Button>
      </div>
      <OrderedRows rows={fields} rowLabel="model" onMove={move} onRemove={remove} minRows={1}>
        {(_field, index) => (
          <LlmModelTargetRow
            name={name}
            index={index}
            llms={llms}
            connections={connections}
            allowedModelCapabilities={allowedModelCapabilities}
          />
        )}
      </OrderedRows>
    </div>
  );
}

type RowProps = {
  name: string;
  index: number;
  llms: LlmManifest[];
  connections: LlmConnection[];
  allowedModelCapabilities?: LlmCapability[];
};

function LlmModelTargetRow({ name, index, llms, connections, allowedModelCapabilities }: RowProps) {
  const form = useFormContext();
  const fieldPath = `${name}.${index}`;
  const modelRef = (useWatch({ control: form.control, name: `${fieldPath}.model` }) as string | undefined) ?? "";
  const connectionId = useWatch({ control: form.control, name: `${fieldPath}.connectionId` }) as string | undefined;
  const [llmKey, modelKey] = splitModelRef(modelRef);
  const formState = useFormState({ control: form.control, name: `${fieldPath}.model` });
  const modelError = form.getFieldState(`${fieldPath}.model`, formState).error;
  const { data: models = [], isLoading: isLoadingModels } = useLLMModels(llmKey, {
    searchParams: connectionId ? { connectionId } : undefined,
  });
  const groups = llms
    .map((llm) => ({ llm, items: connections.filter((connection) => connection.llmKey === llm.key) }))
    .filter((group) => group.items.length > 0);
  const filteredModels = allowedModelCapabilities
    ? models.filter((model) => allowedModelCapabilities.some((capability) => model.capabilities.includes(capability)))
    : models;

  const handleConnectionChange = (nextConnectionId: string) => {
    const connection = connections.find((item) => item.id === nextConnectionId);
    if (!connection) return;
    form.setValue(`${fieldPath}.connectionId`, connection.id, { shouldDirty: true });
    form.setValue(`${fieldPath}.model`, `${connection.llmKey}/`, { shouldDirty: true, shouldTouch: true });
    form.setValue(`${fieldPath}.extraOptions`, undefined, { shouldDirty: true });
  };

  const handleModelChange = (nextModelKey: string) => {
    // Revalidating only when already invalid clears the error without flagging untouched rows.
    form.setValue(`${fieldPath}.model`, `${llmKey}/${nextModelKey}`, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: !!modelError,
    });
  };

  return (
    // Model names run longer than connection names, so they get the wider column.
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
      <Select value={connectionId || undefined} onValueChange={handleConnectionChange}>
        <SelectTrigger
          className="w-full min-w-0"
          aria-label={`Connection for model ${index + 1}`}
          aria-invalid={!!modelError && !connectionId}
        >
          <SelectValue placeholder="Connection" />
        </SelectTrigger>
        <SelectContent>
          {groups.map(({ llm, items }) => (
            <SelectGroup key={llm.key}>
              <SelectLabel>{llm.name}</SelectLabel>
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
        <SelectTrigger
          className="w-full min-w-0"
          aria-label={`Model ${index + 1}`}
          aria-invalid={!!modelError && !!connectionId}
          title={modelKey || undefined}
        >
          <SelectValue placeholder={isLoadingModels ? "Loading…" : "Model"} />
        </SelectTrigger>
        <SelectContent>
          {filteredModels.map((model) => (
            <SelectItem key={model.key} value={model.key}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {modelError && (
        <p role="alert" className="text-destructive col-span-2 text-sm">
          {modelError.message}
        </p>
      )}
    </div>
  );
}
