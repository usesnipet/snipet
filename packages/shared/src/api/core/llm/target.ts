import z from "zod";

export const llmTargetSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    model: z.string(),
    llm: z.string(),
    connection: z.record(z.string(), z.unknown()),
  }),
  z.object({
    status: z.literal("error"),
    model: z.string(),
    error: z.string(),
  }),
]);

export type LLMTarget = z.infer<typeof llmTargetSchema>;
