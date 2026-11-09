import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";

import { ariaDescribedByIds, descriptionId } from "@rjsf/utils";

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
      // The empty field stands for the saved value, so the browser mustn't block submit on a required secret.
      required={false}
      value={props.value === SECRET_PLACEHOLDER ? "" : props.value}
      placeholder="Saved. Leave empty to keep the current value."
      onChange={(value: string | undefined) => props.onChange(value ? value : SECRET_PLACEHOLDER)}
    />
  );
}

/** RJSF's checkbox puts the description above the box; this one puts it below the label, like every other field. */
export function CheckboxWidget({
  id,
  value,
  disabled,
  readonly,
  label,
  hideLabel,
  schema,
  options,
  onChange,
}: WidgetProps) {
  const description = (options.description as string | undefined) || schema.description;
  return (
    <div className="flex flex-col gap-2" aria-describedby={ariaDescribedByIds(id)}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={Boolean(value)}
          disabled={disabled || readonly}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        {!hideLabel && label && (
          <Label htmlFor={id} className="leading-tight">
            {label}
          </Label>
        )}
      </div>
      {!hideLabel && description && (
        <span id={descriptionId(id)} className="text-muted-foreground text-xs font-medium">
          {description}
        </span>
      )}
    </div>
  );
}

/** Widget overrides shared by the schema forms. */
export const widgets = { TextWidget, PasswordWidget, CheckboxWidget };
