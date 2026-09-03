import { FormSelect } from "@/components/form/select";
import { SchemaFormDialog } from "@/components/schema-form";
import { useDialog } from "@/lib/dialog";
import { Settings } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { RJSFSchema } from "@rjsf/utils";
import type { LlmProviderRegistryEntry } from "../schemas";

type ProviderSelectProps = {
  name: string;
  configName: string;
  llms: LlmProviderRegistryEntry[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  fieldclassname?: string;
};

export function ProviderSelect({
  name,
  configName,
  llms,
  label,
  placeholder = "Select a driver",
  disabled,
  fieldclassname,
}: ProviderSelectProps) {
  const form = useFormContext();
  const { openDialog } = useDialog();
  const selectedKey = form.watch(name) as string | undefined;

  const selectedDriver = llms.find((d) => d.key === selectedKey);
  const schema = selectedDriver?.configuration_schema as RJSFSchema | undefined;
  const canConfigure = Boolean(selectedDriver && schema);

  const options = llms.map((driver) => ({
    label: driver.name,
    value: driver.key,
  }));

  const openConfigDialog = () => {
    if (!selectedDriver || !schema) return;

    openDialog({
      component: SchemaFormDialog,
      props: {
        title: selectedDriver.name,
        description: selectedDriver.description,
        schema,
        formData: (form.getValues(configName) as Record<string, unknown>) ?? {},
        onSubmit: (data) => {
          form.setValue(configName, data, {
            shouldDirty: true,
            shouldTouch: true,
          });
        },
      },
    });
  };

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
        return nextKey;
      }}
      action={{
        type: "button",
        size: "icon",
        variant: "outline",
        disabled: disabled || !canConfigure,
        onClick: openConfigDialog,
        "aria-label": "Configure driver",
        icon: <Settings className="size-4" />,
      }}
    />
  );
}
