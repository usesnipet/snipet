import { z } from "zod";

// A JSON object: object at the root, JSON values inside.
export const jsonObjectSchema = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof jsonObjectSchema>;
