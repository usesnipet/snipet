import type { WidgetProps } from "@rjsf/utils";

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
  return (
    <BaseInputTemplate
      {...props}
      type="number"
      extraProps={{ step: step ?? (type === "integer" ? 1 : "any") }}
    />
  );
}

/** Widget overrides shared by the schema forms. */
export const widgets = { TextWidget };
