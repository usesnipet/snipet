import RjsfForm from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import { useMemo } from "react";

import { buildPasswordUiSchema } from "./password-ui-schema";

import type { ErrorSchema, RJSFSchema, UiSchema } from "@rjsf/utils";

type Props = {
  schema: RJSFSchema;
  /** Initial data, read once when the fields mount (remount via `key` on change). */
  defaultData?: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  /** Per-field errors computed by the caller, e.g. `{ token: { __errors: ["Required"] } }`. */
  extraErrors?: ErrorSchema;
};

/**
 * Renders a JSON-schema form inline, inside a surrounding form or dialog.
 * `tagName="div"` keeps it out of the surrounding `<form>` (nested forms are
 * invalid) and the submit button is suppressed — the caller owns submit.
 */
export function SchemaFormFields({ schema, defaultData, onChange, extraErrors }: Props) {
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
      extraErrors={extraErrors}
      liveValidate={false}
      showErrorList={false}
    />
  );
}
