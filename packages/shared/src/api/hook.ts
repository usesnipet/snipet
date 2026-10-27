import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";
import { baseManifestSchema, driverSchema } from "../schemas/manifest.js";

import { agentRunStatusSchema } from "./agent-run.js";

/**
 * What a handler may do at a hook point: `observe` only watches (its reply is
 * ignored), `intercept` runs before the step and may change, block or answer
 * it, `transform` runs after the step and may change its result.
 */
export const hookModeSchema = z.enum(["observe", "intercept", "transform"]);
export type HookMode = z.infer<typeof hookModeSchema>;

/** Every hook point of the agent loop and its mode. */
export const HOOK_MODES = {
  "session.created": "observe",
  "session.deleted": "observe",
  "run.beforeStart": "intercept",
  "run.start": "observe",
  "run.history": "transform",
  "run.context": "transform",
  "run.end": "observe",
  "run.completed": "observe",
  "run.failed": "observe",
  "run.cancelled": "observe",
  "run.maxTurns": "observe",
  "run.cancelRequested": "intercept",
  "turn.start": "intercept",
  "turn.end": "intercept",
  "llm.request": "intercept",
  "llm.started": "observe",
  "llm.skipped": "observe",
  "llm.delta": "transform",
  "llm.toolCall": "observe",
  "llm.usage": "observe",
  "llm.response": "transform",
  "llm.error": "intercept",
  "tool.before": "intercept",
  "tool.after": "transform",
  "tool.error": "intercept",
  "message.beforeSave": "transform",
  "message.saved": "observe",
} as const satisfies Record<string, HookMode>;

export const hookNameSchema = z.enum(Object.keys(HOOK_MODES) as [keyof typeof HOOK_MODES]);
export type HookName = z.infer<typeof hookNameSchema>;

/** The envelope every handler gets; only `payload` changes per hook. */
export const hookEventSchema = z.object({
  version: z.literal(1),
  /** Unique per dispatch: the idempotency key. */
  id: z.uuid(),
  hook: hookNameSchema,
  mode: hookModeSchema,
  occurredAt: z.iso.datetime(),
  run: z.object({ id: z.uuid(), sessionId: z.uuid(), turn: z.number().int(), status: agentRunStatusSchema }),
  agent: z.object({ id: z.uuid(), name: z.string() }),
  owner: z.object({
    userId: z.uuid().nullable(),
    appId: z.uuid().nullable(),
    externalUserId: z.string().nullable(),
    name: z.string().optional(),
  }),
  /** Shared by the hooks of one run, e.g. a trace id set at run.start. */
  metadata: jsonObjectSchema,
  payload: z.unknown(),
});
export type HookEvent<P = unknown> = Omit<z.infer<typeof hookEventSchema>, "payload"> & { payload: P };

/**
 * A handler's reply. Which actions a hook accepts, and the shape of `payload`
 * and `result`, are checked per hook by the dispatcher. `metadata` is merged
 * into the run's.
 */
export const hookResultSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("continue") }),
    z.object({ action: z.literal("modify"), payload: jsonObjectSchema }),
    z.object({ action: z.literal("block"), reason: z.string() }),
    z.object({ action: z.literal("respond"), result: z.unknown() }),
    z.object({ action: z.literal("stop"), reason: z.string(), status: z.enum(["completed", "failed"]).optional() }),
  ])
  .and(z.object({ metadata: jsonObjectSchema.optional() }));
export type HookResult = z.infer<typeof hookResultSchema>;

/** The JSON manifest of a hook handler. */
export const hookManifestSchema = baseManifestSchema.extend({
  handle: driverSchema,
  healthCheck: driverSchema.optional(),
});
export type HookManifest = z.infer<typeof hookManifestSchema>;
