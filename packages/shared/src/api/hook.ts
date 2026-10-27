import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";
import { baseManifestSchema, driverSchema } from "../schemas/manifest.js";

import { agentRunStatusSchema } from "./agent-run.js";
import { llmRoleSchema } from "./llm.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

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
    name: z.string().nullable(),
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

// --- connections ---------------------------------------------------------

/** A configured instance of a hook manifest, e.g. "CRM webhook". */
export const hookConnectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  hookKey: z.string(),
  config: jsonObjectSchema,
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type HookConnection = z.infer<typeof hookConnectionSchema>;

export const paginatedHookConnectionSchema = paginatedSchema(hookConnectionSchema);

/** config is checked against the manifest's `connection` schema by the API. */
export const createHookConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  hookKey: z.string().min(1).max(255),
  config: jsonObjectSchema,
  enabled: z.boolean().optional(),
});
export type CreateHookConnection = z.infer<typeof createHookConnectionSchema>;

export const updateHookConnectionSchema = createHookConnectionSchema.partial();
export type UpdateHookConnection = z.infer<typeof updateHookConnectionSchema>;

export const findHookConnectionsParamsSchema = paginationParamsSchema.extend({
  hookKey: z.string().optional(),
});
export type FindHookConnectionsParams = z.infer<typeof findHookConnectionsParamsSchema>;

// --- agent hooks -----------------------------------------------------------

/** Longest a synchronous handler may take. */
export const MAX_HOOK_TIMEOUT_MS = 30_000;

/** Fires only when every given filter matches; tools and models take globs (`github_*`). */
export const hookMatchSchema = z.object({
  tools: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
  statuses: z.array(agentRunStatusSchema).optional(),
  roles: z.array(llmRoleSchema).optional(),
});
export type HookMatch = z.infer<typeof hookMatchSchema>;

/**
 * Binds a hook connection to hook points of one agent, or of every agent when
 * agentId is null. Global hooks run before the agent's, each group by `order`.
 */
export const agentHookSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid().nullable(),
  hookConnectionId: z.uuid(),
  hooks: z.array(hookNameSchema),
  order: z.number().int(),
  match: hookMatchSchema.nullable(),
  /** null: 5 s synchronous, 30 s async. */
  timeoutMs: z.number().int().nullable(),
  /** `fail` closes the step as failed when the handler errors (guardrails). */
  onError: z.enum(["continue", "fail"]),
  /** Don't wait for the reply: the hook only observes. */
  async: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AgentHook = z.infer<typeof agentHookSchema>;

export const paginatedAgentHookSchema = paginatedSchema(agentHookSchema);

export const createAgentHookSchema = z.object({
  agentId: z.uuid().nullable().optional(),
  hookConnectionId: z.uuid(),
  hooks: z.array(hookNameSchema).min(1),
  order: z.number().int().optional(),
  match: hookMatchSchema.nullable().optional(),
  timeoutMs: z.number().int().min(1).max(MAX_HOOK_TIMEOUT_MS).nullable().optional(),
  onError: z.enum(["continue", "fail"]).optional(),
  async: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type CreateAgentHook = z.infer<typeof createAgentHookSchema>;

export const updateAgentHookSchema = createAgentHookSchema.partial();
export type UpdateAgentHook = z.infer<typeof updateAgentHookSchema>;

export const findAgentHooksParamsSchema = paginationParamsSchema.extend({
  agentId: z.uuid().optional(),
  hookConnectionId: z.uuid().optional(),
});
export type FindAgentHooksParams = z.infer<typeof findAgentHooksParamsSchema>;
