import { FormInput } from "@/components/form/input";
import { FormSwitch } from "@/components/form/switch";
import { Icon } from "@/components/icon";
import { SchemaFormFields } from "@/components/schema-form";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { useLLMs } from "@snipet/client";

import { LlmSelect } from "./llm-select";

import type { RJSFSchema } from "@rjsf/utils";
export function LlmFormFields() {
  const form = useFormContext();
  const { data: llms = [] } = useLLMs();

  const llmKey = form.watch("llmKey") as string | undefined;
  const selected = llms.find((llm) => llm.key === llmKey);
  const configSchema = selected?.connection as RJSFSchema | undefined;
  const hasConfig = Object.keys(configSchema?.properties ?? {}).length > 0;

  const [previousLlmKey, setPreviousLlmKey] = useState<string | undefined>(llmKey);

  return (
    <FieldGroup>
      <FormInput
        name="name"
        label="Name"
        placeholder="e.g. OpenAI (production)"
        description="How this connection shows up when picking a model."
        required
      />

      <LlmSelect
        name="llmKey"
        configName="config"
        llms={llms}
        label="LLM"
        placeholder="Select an LLM"
        onAfterChange={(key) => {
          const prev = llms.find((llm) => llm.key === previousLlmKey);
          const picked = llms.find((llm) => llm.key === key);
          if (picked && (!form.getValues("name") || form.getValues("name") === prev?.name)) {
            form.setValue("name", picked.name, { shouldDirty: true });
          }
          setPreviousLlmKey(key);
        }}
      />

      {selected ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <Icon name={selected.name} icon={selected.icon} />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium leading-none">{selected.name}</span>
              {selected.tags?.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-muted-foreground font-normal"
                >
                  {tag}
                </Badge>
              ))}
            </div>
            {selected.description ? (
              <p className="text-muted-foreground text-xs">{selected.description}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {selected && hasConfig ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Configuration</p>
          <div className="rounded-lg border bg-muted/30 p-3">
            <SchemaFormFields
              key={`${llmKey}-config`}
              schema={configSchema!}
              defaultData={form.getValues("config")}
              onChange={(data) => form.setValue("config", data, { shouldDirty: true })}
            />
          </div>
        </div>
      ) : null}

      <FormSwitch name="enabled" label="Enabled" />
    </FieldGroup>
  );
}
