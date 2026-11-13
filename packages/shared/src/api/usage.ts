import { z } from "zod";

/** USD per 1M tokens; null while the model has no price. */
const pricePerMillionSchema = z.number().nullable();

/**
 * One LLM call of a run: the tokens the provider reported and the prices of
 * its model when it ran, so a later price change doesn't rewrite the past.
 * Ids aren't foreign keys: a record outlives its agent, session and connection.
 */
export const usageRecordSchema = z.object({
  id: z.number().int(),
  agentId: z.uuid(),
  sessionId: z.uuid(),
  runId: z.uuid(),
  userId: z.uuid().nullable(),
  appId: z.uuid().nullable(),
  externalUserId: z.string().nullable(),
  connectionId: z.uuid(),
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  cachedInputTokens: z.number().int(),
  inputPrice: pricePerMillionSchema,
  outputPrice: pricePerMillionSchema,
  cachedInputPrice: pricePerMillionSchema,
  createdAt: z.coerce.date(),
});
export type UsageRecord = z.infer<typeof usageRecordSchema>;
