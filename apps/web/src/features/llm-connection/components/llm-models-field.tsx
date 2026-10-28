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
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>Models</Label>
          <p className="text-muted-foreground text-xs">
            Tried top to bottom — if one errors, Snipet falls back to the next.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => append({ model: "" })}>
          <Plus />
          Add model
        </Button>
      </div>
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
              llms={llms}
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
    </div>
  );
}

type RowProps = {
  name: string;
  index: number;
  llms: LlmManifest[];
  connections: LlmConnection[];
  allowedModelCapabilities?: LlmCapability[];
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function LlmModelTargetRow({ name, index, llms, connections, total, onRemove, onMoveUp, onMoveDown, allowedModelCapabilities }: RowProps) {
  const form = useFormContext();
  const fieldPath = `${name}.${index}`;
  const modelRef = (useWatch({ control: form.control, name: `${fieldPath}.model` }) as string | undefined) ?? "";
  const connectionId = useWatch({ control: form.control, name: `${fieldPath}.connectionId` }) as string | undefined;
  const [llmKey, modelKey] = splitModelRef(modelRef);
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
    form.setValue(`${fieldPath}.model`, `${llmKey}/${nextModelKey}`, { shouldDirty: true, shouldTouch: true });
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
    </div>
  );
}
