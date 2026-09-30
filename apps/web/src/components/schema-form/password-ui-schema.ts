import type { RJSFSchema, UiSchema } from "@rjsf/utils";

const PASSWORD_FIELD_RE = /(api[_-]?key|password|secret|token)/i;

/** Marks secret-like properties as password widgets when the schema omits format. */
export function buildPasswordUiSchema(schema: RJSFSchema): UiSchema {
  const properties = schema.properties;
  if (!properties || typeof properties !== "object") {
    return {};
  }

  const ui: UiSchema = {};

  for (const [key, prop] of Object.entries(properties)) {
    if (!prop || typeof prop !== "object" || Array.isArray(prop)) continue;

    const propSchema = prop as RJSFSchema;
    if (propSchema.type === "object") {
      const nested = buildPasswordUiSchema(propSchema);
      if (Object.keys(nested).length > 0) {
        ui[key] = nested;
      }
      continue;
    }

    if (
      propSchema.type === "string" &&
      propSchema.format !== "password" &&
      PASSWORD_FIELD_RE.test(key)
    ) {
      ui[key] = { "ui:widget": "password" };
    }
  }

  return ui;
}
