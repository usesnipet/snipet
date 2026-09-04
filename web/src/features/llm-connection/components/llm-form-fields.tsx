import { FormInput } from "@/components/form/input";
import { FormSwitch } from "@/components/form/switch";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import { useFormContext } from "react-hook-form";

import { useLlmProviders } from "../hooks";

import { ProviderConfigFields } from "./provider-config-fields";
import { ProviderIcon } from "./provider-icon";
import { ProviderSelect } from "./provider-select";

import type { RJSFSchema } from "@rjsf/utils";
import { useState } from "react";

export function LlmFormFields() {
  const form = useFormContext();
  const { data: providers = [] } = useLlmProviders();

  const providerKey = form.watch("provider") as string | undefined;
  const selected = providers.find((provider) => provider.key === providerKey);
  const schema = (selected?.configuration_schema ?? undefined) as
    | RJSFSchema
    | undefined;

  const [previousProviderKey, setPreviousProviderKey] = useState<string | undefined>(providerKey);
  console.log(previousProviderKey, providerKey);

  return (
    <FieldGroup>
      <FormInput
        name="name"
        label="Name"
        placeholder="e.g. OpenAI (production)"
        description="How this connection shows up when picking a model."
        required
      />

      <ProviderSelect
        name="provider"
        configName="config"
        providers={providers}
        label="Provider"
        placeholder="Select a provider"
        onAfterChange={(key) => {
          const prev = providers.find((provider) => provider.key === previousProviderKey);
          const picked = providers.find((provider) => provider.key === key);
          if (picked && (!form.getValues("name") || form.getValues("name") === prev?.name)) {
            form.setValue("name", picked.name, { shouldDirty: true });
          }
          setPreviousProviderKey(key);
        }}
      />

      {selected ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <ProviderIcon
            name={selected.name}
            providerKey={selected.key}
            icon={selected.icon}
          />
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

      {selected && schema ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Configuration</p>
          <div className="rounded-lg border bg-muted/30 p-3">
            <ProviderConfigFields
              key={providerKey}
              schema={schema}
              defaultData={form.getValues("config") as Record<string, unknown>}
              onChange={(data) =>
                form.setValue("config", data, { shouldDirty: true })
              }
            />
          </div>
        </div>
      ) : null}

      <FormSwitch name="enabled" label="Enabled" />
    </FieldGroup>
  );
}
