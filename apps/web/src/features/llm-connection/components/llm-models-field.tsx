import { OrderedRows } from "@/components/form/ordered-rows";
import { Button } from "@/components/ui/button";
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
/** A row before its connection and model are picked. */
const EMPTY_TARGET = { connectionId: "", model: "" };

type Props = {
  /** Field-array path holding `ExecuteLlmTarget[]` (`ExecuteLlmTarget` in @snipet/shared). */
  name: string;
  /** If set, only models with these capabilities will be shown. */
  allowedModelCapabilities?: LlmCapability[];
};

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
    if (fields.length === 0) append(EMPTY_TARGET);
  }, [fields.length, append]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Models</h2>
        <p className="text-muted-foreground text-sm">The agent uses the first one. If it fails, it tries the next.</p>
      </div>
      <OrderedRows rows={fields} rowLabel="model" onMove={move} onRemove={remove} minRows={1} chained>
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground sm:ml-12.5"
        onClick={() => append(EMPTY_TARGET)}
      >
        <Plus />
        Add fallback model
      </Button>
    </section>
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
  const [connectionId, modelKey] = useWatch({
    control: form.control,
    name: [`${fieldPath}.connectionId`, `${fieldPath}.model`],
  }) as (string | undefined)[];
  const llmKey = connections.find((connection) => connection.id === connectionId)?.llmKey ?? "";
  const formState = useFormState({ control: form.control, name: fieldPath });
  const connectionError = form.getFieldState(`${fieldPath}.connectionId`, formState).error;
  const modelError = form.getFieldState(`${fieldPath}.model`, formState).error;
  const error = connectionError ?? modelError;
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
    form.setValue(`${fieldPath}.connectionId`, connection.id, { shouldDirty: true, shouldValidate: !!connectionError });
    form.setValue(`${fieldPath}.model`, "", { shouldDirty: true, shouldTouch: true });
  };

  const handleModelChange = (nextModelKey: string) => {
    // Revalidating only when already invalid clears the error without flagging untouched rows.
    form.setValue(`${fieldPath}.model`, nextModelKey, {
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
          aria-invalid={!!connectionError}
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
          aria-invalid={!connectionError && !!modelError}
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

      {error && (
        <p role="alert" className="text-destructive col-span-2 text-sm">
          {error.message}
        </p>
      )}
    </div>
  );
}
