import { createAgentSchema } from "@snipet/shared";
import { z } from "zod";

// Form shape behind the create/edit dialog: max turns is typed as text.
export const agentFormSchema = createAgentSchema.extend({
  maxTurns: z.coerce
    .number<string | number>()
    .int()
    .min(1, "Max turns must be at least 1")
    .max(500, "Max turns must be at most 500"),
});
export type AgentFormInput = z.input<typeof agentFormSchema>;
export type AgentForm = z.output<typeof agentFormSchema>;
