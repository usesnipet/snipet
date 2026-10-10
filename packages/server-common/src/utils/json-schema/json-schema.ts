import { BadRequestException } from "@nestjs/common";
import z from "zod";

export type JsonSchema = Record<string, unknown>;

// Throws if schema is not a valid JSON Schema.
export function checkJsonSchema(schema: JsonSchema): boolean {
  try {
    z.fromJSONSchema(schema);
    return true;
  } catch {
    return false;
  }
}

// Validates data against a JSON Schema and returns it with the schema's
// "default"s filled in. A null/undefined schema accepts anything.
// Note: a default on a nested object is used as-is, its own inner defaults
// are not re-applied.
export function validateJson<T = Record<string, unknown>>(schema: JsonSchema | null | undefined, data: unknown): T {
  if (!schema) return data as T;
  const result = z.fromJSONSchema(schema).safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: "validation failed",
      details: result.error.issues,
    });
  }
  return result.data as T;
}
