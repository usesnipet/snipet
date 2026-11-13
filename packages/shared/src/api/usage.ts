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

export enum UsageGroupBy {
  AGENT = "agent",
  /** UTC day. */
  DAY = "day",
}

/** from/to default to the last 30 days; to is exclusive. */
export const usageReportParamsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(UsageGroupBy).default(UsageGroupBy.AGENT),
  agentId: z.uuid().optional(),
});
export type UsageReportParams = z.infer<typeof usageReportParamsSchema>;

/** Costs in USD; null when no call of the group has a price, partial when only some do. */
export const usageReportRowSchema = z.object({
  /** The agent id or the day (YYYY-MM-DD), per groupBy. */
  key: z.string(),
  /** The agent's name when grouping by agent; null for the others, or when the agent was deleted. */
  label: z.string().nullable(),
  calls: z.number().int(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cachedInputTokens: z.number(),
  inputCost: z.number().nullable(),
  outputCost: z.number().nullable(),
  cost: z.number().nullable(),
});
export type UsageReportRow = z.infer<typeof usageReportRowSchema>;

/** from/to as in the report; the calls of a single day are the use. */
export const usageCallsParamsSchema = usageReportParamsSchema.pick({ from: true, to: true, agentId: true });
export type UsageCallsParams = z.infer<typeof usageCallsParamsSchema>;

/** One LLM call with its cost in USD, null when its model had no price. */
export const usageCallSchema = z.object({
  id: z.number().int(),
  createdAt: z.coerce.date(),
  agentId: z.uuid(),
  /** Null when the agent was deleted. */
  agentName: z.string().nullable(),
  model: z.string(),
  connectionId: z.uuid(),
  /** Null when the connection was deleted. */
  connectionName: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cachedInputTokens: z.number(),
  cost: z.number().nullable(),
});
export type UsageCall = z.infer<typeof usageCallSchema>;
