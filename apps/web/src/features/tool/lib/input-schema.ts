export type ToolParameter = {
  name: string;
  /** Human-readable JSON Schema type, e.g. `string`, `number[]`, `string | null`. */
  type: string;
  required: boolean;
  description?: string;
  enum?: unknown[];
  default?: unknown;
};

type JsonSchema = Record<string, unknown>;

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeType(schema: JsonSchema): string {
  const { type } = schema;
  if (type === "array") {
    return isSchema(schema.items) ? `${describeType(schema.items)}[]` : "array";
  }
  if (typeof type === "string") return type;
  if (Array.isArray(type)) return type.join(" | ");

  const variants = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(variants)) {
    return Array.from(new Set(variants.filter(isSchema).map(describeType))).join(" | ");
  }
  if (Array.isArray(schema.enum)) return "enum";
  if (schema.const !== undefined) return "const";
  return "any";
}

/** Flattens the top-level properties of a tool's JSON Schema input into a parameter list, required first. */
export function toolParameters(inputSchema: JsonSchema): ToolParameter[] {
  const properties = isSchema(inputSchema.properties) ? inputSchema.properties : {};
  const required = new Set(
    Array.isArray(inputSchema.required) ? inputSchema.required.filter((key) => typeof key === "string") : [],
  );

  return Object.entries(properties)
    .map(([name, raw]): ToolParameter => {
      const schema = isSchema(raw) ? raw : {};
      return {
        name,
        type: describeType(schema),
        required: required.has(name),
        description: typeof schema.description === "string" ? schema.description : undefined,
        enum: Array.isArray(schema.enum) ? schema.enum : undefined,
        default: schema.default,
      };
    })
    .sort((a, b) => Number(b.required) - Number(a.required));
}
