import z from "zod";

/** One model to try, resolved to its llm and connection config, or the reason it can't be used. */
export const llmTargetSchema = z
  .object({
    model: z.string(),
  })
  .and(
    z.union([
      z.object({
        llm: z.string(),
        connection: z.record(z.string(), z.unknown()),
      }),
      z.object({
        error: z.string(),
      }),
    ]),
  );
export type LLMTarget = z.infer<typeof llmTargetSchema>;
