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

  // A provider can offer several auth methods; render the first "static" one
  // that carries a schema (most providers only declare one). "no-auth" needs
  // no form at all.
  const authSchema = selected?.auth.find((method) => method.type === "static" && method.data)
    ?.data as RJSFSchema | undefined;
  const configSchema = (selected?.schemas.config ?? undefined) as RJSFSchema | undefined;

  // The "config" form field holds the nested connection options the backend
  // expects: { auth: {...}, config: {...} }.
  const existingConnectionOptions = form.getValues("config") as
    | { auth?: Record<string, unknown>; config?: Record<string, unknown> }
    | undefined;

  const [previousProviderKey, setPreviousProviderKey] = useState<string | undefined>(providerKey);

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

      {selected && authSchema ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Authentication</p>
          <div className="rounded-lg border bg-muted/30 p-3">
            <ProviderConfigFields
              key={`${providerKey}-auth`}
              schema={authSchema}
              defaultData={existingConnectionOptions?.auth}
              onChange={(data) =>
                form.setValue("config.auth", data, { shouldDirty: true })
              }
            />
          </div>
        </div>
      ) : null}

      {selected && configSchema ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Configuration</p>
          <div className="rounded-lg border bg-muted/30 p-3">
            <ProviderConfigFields
              key={`${providerKey}-config`}
              schema={configSchema}
              defaultData={existingConnectionOptions?.config}
              onChange={(data) =>
                form.setValue("config.config", data, { shouldDirty: true })
              }
            />
          </div>
        </div>
      ) : null}

      <FormSwitch name="enabled" label="Enabled" />
    </FieldGroup>
  );
}
