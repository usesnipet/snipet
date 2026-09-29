import { BadRequestException } from "@nestjs/common";
import z from "zod";

export type JsonSchema = Record<string, unknown>;

// Compiled schemas cached by object identity; schemas are usually constants
// or loaded once from the DB.
const compiled = new WeakMap<JsonSchema, z.ZodType>();

function compile(schema: JsonSchema): z.ZodType {
  let zodSchema = compiled.get(schema);
  if (!zodSchema) {
    zodSchema = z.fromJSONSchema(schema);
    compiled.set(schema, zodSchema);
  }
  return zodSchema;
}

// Throws if schema is not a valid JSON Schema.
export function checkJsonSchema(schema: JsonSchema): void {
  compile(schema);
}

// Validates data against a JSON Schema and returns it with the schema's
// "default"s filled in. A null/undefined schema accepts anything.
// Note: a default on a nested object is used as-is, its own inner defaults
// are not re-applied.
export function validateJson<T = Record<string, unknown>>(schema: JsonSchema | null | undefined, data: unknown): T {
  if (!schema) return data as T;
  const result = compile(schema).safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: "validation failed",
      details: result.error.issues,
    });
  }
  return result.data as T;
}
