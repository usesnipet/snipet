import { FormSelect } from "@/components/form/select";
import { useFormContext } from "react-hook-form";

import type { LlmProvider } from "../schemas";

type ProviderSelectProps = {
  name: string;
  /** Field that holds the provider config — reset when the provider changes. */
  configName: string;
  providers: LlmProvider[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  fieldclassname?: string;
  /** Called after the provider changes, with the new driver key. */
  onAfterChange?: (key: string) => void;
};

export function ProviderSelect({
  name,
  configName,
  providers,
  label,
  placeholder = "Select a provider",
  disabled,
  fieldclassname,
  onAfterChange,
}: ProviderSelectProps) {
  const form = useFormContext();

  const options = providers.map((provider) => ({
    label: provider.name,
    value: provider.key,
  }));

  return (
    <FormSelect
      name={name}
      label={label}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      fieldclassname={fieldclassname}
      onValueChange={(nextKey) => {
        form.setValue(configName, {}, { shouldDirty: true, shouldTouch: true });
        onAfterChange?.(nextKey);
        return nextKey;
      }}
    />
  );
}
