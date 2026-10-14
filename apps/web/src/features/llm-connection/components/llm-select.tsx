import { FormSelect } from "@/components/form/select";
import { useFormContext } from "react-hook-form";

import type { LlmManifest } from "@snipet/shared";

type LlmSelectProps = {
  name: string;
  /** Field that holds the connection config — reset when the llm changes. */
  configName: string;
  llms: LlmManifest[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  fieldclassname?: string;
  /** Called after the llm changes, with the new driver key. */
  onAfterChange?: (key: string) => void;
};

export function LlmSelect({
  name,
  configName,
  llms,
  label,
  placeholder = "Select an LLM",
  disabled,
  fieldclassname,
  onAfterChange,
}: LlmSelectProps) {
  const form = useFormContext();

  const options = llms.map((llm) => ({
    label: llm.name,
    value: llm.key,
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
