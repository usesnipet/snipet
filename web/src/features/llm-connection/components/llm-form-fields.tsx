import { FormInput } from "@/components/form/input";
import { FieldGroup } from "@/components/ui/field";

import { useLlmProviders } from "../hooks";

import { ProviderSelect } from "./provider-select";

export function LlmFormFields() {
  const { data } = useLlmProviders();

  return (
    <FieldGroup>
      <FormInput name="name" label="Name" required />
      <ProviderSelect
        name="provider"
        configName="config"
        llms={data ?? []}
        label="Provider"
        placeholder="Select a provider"
      />
    </FieldGroup>
  );
}
