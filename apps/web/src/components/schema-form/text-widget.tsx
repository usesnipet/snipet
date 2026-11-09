import { useState } from "react";

import type { WidgetProps } from "@rjsf/utils";

/** What the API sends in place of a stored secret, and reads back as "keep it" (`SECRET_PLACEHOLDER` in server-common). */
const SECRET_PLACEHOLDER = "__secret__";

/**
 * RJSF's text widget with a real number input for `number`/`integer` fields.
 * RJSF falls back to a text input when the locale's decimal separator isn't
 * "." (pt-BR), and only reads `multipleOf` for the step, so manifests set
 * `step` instead.
 */
export function TextWidget(props: WidgetProps) {
  const { BaseInputTemplate } = props.registry.templates;
  const { type, step } = props.schema as { type?: string; step?: number };
  if (type !== "number" && type !== "integer") return <BaseInputTemplate {...props} />;
  return <BaseInputTemplate {...props} type="number" extraProps={{ step: step ?? (type === "integer" ? 1 : "any") }} />;
}

/**
 * Password input that shows a saved secret as an empty field with a hint
 * instead of dots of the placeholder. Leaving it empty sends the placeholder
 * back, so the API keeps the stored value.
 */
export function PasswordWidget(props: WidgetProps) {
  const { BaseInputTemplate } = props.registry.templates;
  const [hasSavedValue] = useState(props.value === SECRET_PLACEHOLDER);
  if (!hasSavedValue) return <BaseInputTemplate {...props} type="password" />;
  return (
    <BaseInputTemplate
      {...props}
      type="password"
      value={props.value === SECRET_PLACEHOLDER ? "" : props.value}
      placeholder="Saved. Leave empty to keep the current value."
      onChange={(value: string | undefined) => props.onChange(value ? value : SECRET_PLACEHOLDER)}
    />
  );
}

/** Widget overrides shared by the schema forms. */
export const widgets = { TextWidget, PasswordWidget };
