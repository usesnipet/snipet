import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";
import { baseManifestSchema, driverSchema } from "../schemas/manifest.js";

import { agentRunStatusSchema } from "./agent-run.js";
import { executeLlmTargetSchema, llmMessageSchema, llmToolCallPartSchema, llmToolSchema } from "./llm.js";
import { paginatedSchema, paginationParamsSchema } from "./pagination.js";

const actionResultSchema = z.object({ content: z.string(), isError: z.boolean() });
const toolCallSchema = z.object({ call: llmToolCallPartSchema });
const durationSchema = z.number();

/** What a synchronous handler's reply may do besides `continue`. */
export const hookActionSchema = z.enum(["modify", "block", "respond"]);
export type HookAction = z.infer<typeof hookActionSchema>;

/** The `match` filters a hook point can be narrowed by. */
type HookMatchKey = "tools" | "models";

type HookDef = {
  payload: z.ZodObject;
  /** Empty: handlers only observe, their reply is ignored. */
  actions: readonly HookAction[];
  /** The shape of a `respond` result, when the hook accepts one. */
  respond?: z.ZodType;
  match: readonly HookMatchKey[];
};

/**
 * Every hook point of the agent loop: the payload its handlers get and what
 * their reply may do. `modify` merges into the payload (shallow) and must
 * still fit it; `block` stops the step (a tool call gets the reason as an
 * error result, any other step fails the run); `respond` answers the step
 * instead of running it.
 */
export const HOOKS = {
  "run.start": { payload: z.object({ input: z.string() }), actions: ["block"], match: [] },
  "run.context": {
    payload: z.object({ system: z.array(llmMessageSchema), tools: z.array(llmToolSchema) }),
    actions: ["modify", "block"],
    match: [],
  },
  "llm.request": {
    payload: z.object({
      messages: z.array(llmMessageSchema),
      tools: z.array(llmToolSchema),
      targets: z.array(executeLlmTargetSchema),
    }),
    actions: ["modify", "block"],
    match: ["models"],
  },
  "llm.response": {
    payload: z.object({
      model: z.string().nullable(),
      message: llmMessageSchema,
      skipped: z.array(z.unknown()),
      durationMs: durationSchema,
    }),
    actions: ["modify", "block"],
    match: ["models"],
  },
  "tool.before": {
    payload: toolCallSchema,
    actions: ["modify", "block", "respond"],
    respond: actionResultSchema,
    match: ["tools"],
  },
  "tool.after": {
    payload: toolCallSchema.extend({ result: actionResultSchema, durationMs: durationSchema }),
    actions: ["modify"],
    match: ["tools"],
  },
  "tool.error": {
    payload: toolCallSchema.extend({
      result: actionResultSchema,
      reason: z.enum(["cancelled", "error_result", "unknown_tool"]),
      durationMs: durationSchema,
    }),
    actions: ["modify"],
    match: ["tools"],
  },
  "run.end": {
    payload: z.object({
      status: agentRunStatusSchema,
      error: z.string().nullable(),
      turns: z.number().int(),
      durationMs: durationSchema,
    }),
    actions: [],
    match: [],
  },
  "run.completed": { payload: z.object({}), actions: [], match: [] },
  /** Carries the raw error the client never sees. */
  "run.failed": {
    payload: z.object({
      error: z.object({ name: z.string().optional(), message: z.string(), stack: z.string().optional() }),
    }),
    actions: [],
    match: [],
  },
  "run.cancelled": { payload: z.object({}), actions: [], match: [] },
  "run.maxTurns": { payload: z.object({}), actions: [], match: [] },
} as const satisfies Record<string, HookDef>;

export const hookNameSchema = z.enum(Object.keys(HOOKS) as [keyof typeof HOOKS]);
export type HookName = z.infer<typeof hookNameSchema>;

export type HookPayload<K extends HookName> = z.infer<(typeof HOOKS)[K]["payload"]>;
export type HookRespond<K extends HookName> = (typeof HOOKS)[K] extends { respond: infer S extends z.ZodType }
  ? z.infer<S>
  : never;

/** The envelope every handler gets; only `payload` changes per hook. */
export const hookEventSchema = z.object({
  version: z.literal(1),
  /** Unique per dispatch: the idempotency key. */
  id: z.uuid(),
  hook: hookNameSchema,
  /** What this handler's reply may do; empty when it's ignored (async or observe-only). */
  actions: z.array(hookActionSchema),
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
/** Discriminated by `hook`, so narrowing it types the payload. */
export type HookEvent<K extends HookName = HookName> = {
  [H in K]: Omit<z.infer<typeof hookEventSchema>, "hook" | "payload"> & { hook: H; payload: HookPayload<H> };
}[K];

/**
 * A handler's reply. Which actions a hook accepts, and the shape of `payload`
 * and `result`, are checked per hook by the runner. `metadata` is merged
 * into the run's.
 */
export const hookResultSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("continue") }),
    z.object({ action: z.literal("modify"), payload: jsonObjectSchema }),
    z.object({ action: z.literal("block"), reason: z.string() }),
    z.object({ action: z.literal("respond"), result: z.unknown() }),
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

/** Longest a handler may take. */
export const MAX_HOOK_TIMEOUT_MS = 30_000;

/**
 * Fires only when every given filter matches, by glob (`github_*`): tools on
 * the call's name, models on the model asked for or answering. A hook point
 * only applies the filters in its `match`.
 */
export const hookMatchSchema = z.object({
  tools: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
});
export type HookMatch = z.infer<typeof hookMatchSchema>;

/**
 * Binds a hook connection to one hook point of one agent, or of every agent
 * when agentId is null. Global hooks run before the agent's. Within each,
 * synchronous handlers run stage by stage: the same stage in parallel (then
 * a reply may only block), each stage getting the payload the last one left.
 * Async handlers get the final payload and their reply is ignored.
 */
export const agentHookSchema = z.object({
  id: z.uuid(),
  agentId: z.uuid().nullable(),
  hookConnectionId: z.uuid(),
  event: hookNameSchema,
  stage: z.number().int(),
  /** Order in the agent's list; breaks ties within a stage. */
  position: z.number().int(),
  match: hookMatchSchema.nullable(),
  /** null: 5 s synchronous, 30 s async. */
  timeoutMs: z.number().int().nullable(),
  /** `fail` blocks the step when the handler errors (guardrails). */
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
  event: hookNameSchema,
  stage: z.number().int().min(0).optional(),
  position: z.number().int().optional(),
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
