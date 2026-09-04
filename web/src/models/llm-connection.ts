import { z } from "zod";

// The LlmConnection entity — the read model as it comes off the API.
// A named, configured connection to an LLM provider (the provider drivers
// themselves are the registry, not this entity).
// Relations to other entities go here (import them from "@/models/<other>"),
// never from another feature's schemas. DTOs live in the feature's schemas.ts.
export const llmConnectionSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    provider: z.string(),
    config: z.record(z.string(), z.unknown()),
    enabled: z.boolean(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .strict();

export type LlmConnection = z.infer<typeof llmConnectionSchema>;
