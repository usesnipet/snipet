import z from "zod";

import { PluginValidationError } from "../errors.js";

export function validateOptions<T>(schema: z.ZodType<T>, options: unknown): T {
  const result = schema.safeParse(options);
  if (!result.success) throw new PluginValidationError({ message: "invalid options", details: result.error.issues });
  return result.data;
}
