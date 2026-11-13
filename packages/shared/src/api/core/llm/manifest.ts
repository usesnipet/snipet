import { z } from "zod";

import { baseManifestSchema, driverSchema } from "../../../schemas/manifest.js";

/**
 * The JSON manifest of an LLM. Vision/tools are per model (see
 * LlmModel.capabilities), so text, vision and tools all go through `chat`.
 */
export const llmManifestSchema = baseManifestSchema.extend({
  capabilities: z.object({
    models: driverSchema,
    /** generate + stream */
    chat: driverSchema.optional(),
    healthCheck: driverSchema.optional(),
  }),
});
export type LLMManifest = z.infer<typeof llmManifestSchema>;
