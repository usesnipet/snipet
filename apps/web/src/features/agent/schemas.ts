import { createAgentSchema, MAX_HOOK_TIMEOUT_MS } from "@snipet/shared";
import { z } from "zod";

const hookSchema = createAgentSchema.shape.hooks.unwrap().element;

/**
 * Form shape behind the create/edit dialog; max turns and hook timeouts are
 * typed as text and coerced (an empty timeout means the default).
 */
export const agentFormSchema = createAgentSchema.extend({
  maxTurns: z.coerce
    .number<string | number>()
    .int()
    .min(1, "Max turns must be at least 1")
    .max(500, "Max turns must be at most 500"),
  hooks: z.array(
    hookSchema.extend({
      hookConnectionId: z.uuid("Select a connection"),
      hooks: hookSchema.shape.hooks.min(1, "Select at least one event"),
      timeoutMs: z.preprocess(
        (v) => (v === "" || v == null ? null : v),
        z.coerce
          .number<string | number>()
          .int()
          .min(1, "Timeout must be at least 1 ms")
          .max(MAX_HOOK_TIMEOUT_MS, `Timeout must be at most ${MAX_HOOK_TIMEOUT_MS} ms`)
          .nullable(),
      ),
    }),
  ),
});
export type AgentFormInput = z.input<typeof agentFormSchema>;
export type AgentForm = z.output<typeof agentFormSchema>;
