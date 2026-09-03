import z from "zod";

export const systemInfoSchema = z.object({
  version: z.string(),
})
export type SystemInfo = z.infer<typeof systemInfoSchema>