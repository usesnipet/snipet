import { z } from "zod";

export enum LLMCapability {
  TEXT = "text",
  VISION = "vision",
  TOOLS = "tools",
  EMBEDDING = "embedding",
}
export const llmCapabilitySchema = z.enum(LLMCapability);

export const llmModelSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(llmCapabilitySchema),
  contextWindow: z.number(), // 0 = unknown.
  maxOutputTokens: z.number().nullish(),
});
export type LLMModel = z.infer<typeof llmModelSchema>;
