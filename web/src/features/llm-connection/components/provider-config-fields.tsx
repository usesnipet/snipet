import RjsfForm from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import { useMemo } from "react";

import { buildPasswordUiSchema } from "@/components/schema-form";

import type { RJSFSchema, UiSchema } from "@rjsf/utils";

type Props = {
  /** JSON schema of the selected provider driver's `configuration_schema`. */
  schema: RJSFSchema;
  /** Initial config, read once when the field mounts (remount via `key` on change). */
  defaultData?: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
};

/**
 * Renders the selected provider's configuration form inline, instead of behind a
 * nested dialog. `tagName="div"` keeps it out of the surrounding `<form>` (nested
 * forms are invalid) and the submit button is suppressed — the dialog owns submit.
 */
export function ProviderConfigFields({ schema, defaultData, onChange }: Props) {
  const uiSchema = useMemo<UiSchema>(
    () => ({
      ...buildPasswordUiSchema(schema),
      "ui:submitButtonOptions": { norender: true },
    }),
    [schema],
  );

  return (
    <RjsfForm
      tagName="div"
      schema={schema}
      formData={defaultData}
      validator={validator}
      uiSchema={uiSchema}
      onChange={(e) => onChange(e.formData ?? {})}
      liveValidate={false}
      showErrorList={false}
    />
  );
}
