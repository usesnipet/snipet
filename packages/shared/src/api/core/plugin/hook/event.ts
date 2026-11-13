import z from "zod";

import { jsonObjectSchema } from "../../../../schemas/json.js";
import { agentRunStatusSchema } from "../../../agent-run.js";
import { ownerSchema } from "../../owner.js";

import { HookName, hookNameSchema, HookPayload, HOOKS } from "./hooks.js";

// --- event -----------------------------------------------------------------

/** Envelope fields every hook's event shares; only `hook` and `payload` change per hook. */
export const hookEventBaseSchema = z.object({
  /** Unique per dispatch: the idempotency key. */
  id: z.uuid(),
  hook: hookNameSchema,
  payload: z.unknown(),
  occurredAt: z.iso.datetime(),
  /** turn is 0 before the first LLM call. */
  run: z.object({ id: z.uuid(), sessionId: z.uuid(), turn: z.number().int(), status: agentRunStatusSchema }),
  agent: z.object({ id: z.uuid(), name: z.string() }),
  owner: ownerSchema,
  /** The agent's settings for this plugin. */
  settings: jsonObjectSchema,
  /** What this plugin stored earlier in the run; other plugins don't see it. */
  state: jsonObjectSchema,
});

/** Discriminated by `hook`, so narrowing it types the payload. */
export type HookEvent<K extends HookName = HookName> = {
  [H in K]: z.infer<typeof hookEventBaseSchema> & { hook: H; payload: HookPayload<H> };
}[K];

const eventSchemas = new Map<HookName, z.ZodType>();

/** The event one hook's handlers get, payload checked against the hook's. */
export function hookEventSchemaOf<K extends HookName>(hook: K): z.ZodType<HookEvent<K>> {
  let schema = eventSchemas.get(hook);
  if (!schema) {
    schema = hookEventBaseSchema.extend({ hook: z.literal(hook), payload: HOOKS[hook].payload });
    eventSchemas.set(hook, schema);
  }
  return schema as z.ZodType<HookEvent<K>>;
}
