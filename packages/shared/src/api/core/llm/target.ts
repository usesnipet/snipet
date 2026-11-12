import z from "zod";

// );
export const llmTargetSchema = z
  .object({
    metadata: z.record(z.string(), z.unknown()),
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
