import { z } from "zod";

import { jsonObjectSchema } from "../schemas/json.js";
import { driverSchema } from "../schemas/manifest.js";

import { agentRunStatusSchema } from "./agent-run.js";
import {
  executeLlmTargetSchema,
  llmMessageSchema,
  llmToolCallPartSchema,
  llmToolSchema,
  llmUsageSchema,
} from "./llm.js";

// --- constants -------------------------------------------------------------

/** Version of the event envelope handlers get; bump on a breaking change. */
export const HOOK_EVENT_VERSION = 2;
/** Timeout of a handler without its own: it holds the run up. */
export const DEFAULT_HOOK_TIMEOUT_MS = 5_000;
/** Timeout of a background handler without its own. */
export const DEFAULT_BACKGROUND_HOOK_TIMEOUT_MS = 30_000;
/** Longest a handler may take. */
export const MAX_HOOK_TIMEOUT_MS = 30_000;

// --- hooks -----------------------------------------------------------------

const toolResultSchema = z.object({ content: z.string(), isError: z.boolean() });
const durationMsSchema = z.number();

/** Why a tool call ended in an error result. */
export const hookToolErrorReasonSchema = z.enum(["cancelled", "error_result", "unknown_tool", "timeout", "denied"]);
export type HookToolErrorReason = z.infer<typeof hookToolErrorReasonSchema>;

/** What a handler's reply may do besides `continue`, which every hook accepts. */
export const hookActionSchema = z.enum(["modify", "deny", "respond", "stop"]);
export type HookAction = z.infer<typeof hookActionSchema>;

type HookDefinition = {
  payload: z.ZodObject;
  /** Empty: handlers only observe. */
  actions: readonly HookAction[];
  /** The shape of a `respond` result, when the hook accepts one. */
  respond?: z.ZodType;
};

/**
 * Every hook of the agent loop, in loop order: the payload its handlers get
 * and what their reply may do. `modify` merges into the payload (shallow) and
 * must still fit it; `deny` skips a tool call, the model getting the reason;
 * `respond` answers the step instead of running it; `stop` fails the run with
 * the reason.
 */
export const HOOKS = {
  "run.start": { payload: z.object({ input: z.string() }), actions: ["stop"] },
  "run.context": {
    payload: z.object({
      /** Read-only: a modified input is ignored. */
      input: z.string(),
      system: z.array(llmMessageSchema),
      tools: z.array(llmToolSchema),
    }),
    actions: ["modify", "stop"],
  },
  "llm.request": {
    payload: z.object({
      messages: z.array(llmMessageSchema),
      tools: z.array(llmToolSchema),
      targets: z.array(executeLlmTargetSchema),
    }),
    actions: ["modify", "respond", "stop"],
    respond: llmMessageSchema,
  },
  "llm.response": {
    payload: z.object({
      model: z.string().nullable(),
      message: llmMessageSchema,
      /** null when the provider doesn't report it. */
      usage: llmUsageSchema.nullable(),
      skipped: z.array(z.unknown()),
      durationMs: durationMsSchema,
    }),
    actions: ["modify", "stop"],
  },
  "tool.before": {
    payload: z.object({
      call: llmToolCallPartSchema,
      /** The plugin connection the tool belongs to; null for an unknown tool. */
      tool: z.object({ id: z.string(), name: z.string() }).nullable(),
    }),
    actions: ["modify", "deny", "respond", "stop"],
    respond: toolResultSchema,
  },
  "tool.after": {
    payload: z.object({ call: llmToolCallPartSchema, result: toolResultSchema, durationMs: durationMsSchema }),
    actions: ["modify", "stop"],
  },
  "tool.error": {
    payload: z.object({
      call: llmToolCallPartSchema,
      result: toolResultSchema,
      reason: hookToolErrorReasonSchema,
      durationMs: durationMsSchema,
    }),
    actions: ["modify", "stop"],
  },
  "run.end": {
    payload: z.object({
      status: agentRunStatusSchema,
      /** What the client saw. */
      error: z.string().nullable(),
      /** What failed, for hooks only: it may hold hosts or credentials the client must not see. */
      rawError: z.object({ name: z.string().optional(), message: z.string(), stack: z.string().optional() }).nullable(),
      input: z.string(),
      /** The run's messages, from the user's on. */
      messages: z.array(llmMessageSchema),
      /** Text of the final reply; null when the run didn't complete. */
      output: z.string().nullable(),
      turns: z.number().int(),
      /** Summed over the run's LLM calls. */
      usage: llmUsageSchema,
      durationMs: durationMsSchema,
    }),
    actions: [],
  },
} as const satisfies Record<string, HookDefinition>;

export const hookNameSchema = z.enum(Object.keys(HOOKS) as [keyof typeof HOOKS]);

export const ALL_HOOKS = hookNameSchema.options as readonly HookName[];

export type HookName = z.infer<typeof hookNameSchema>;

export type HookPayload<K extends HookName> = z.infer<(typeof HOOKS)[K]["payload"]>;
export type HookRespond<K extends HookName> = (typeof HOOKS)[K] extends { respond: infer S extends z.ZodType }
  ? z.infer<S>
  : never;

/** The envelope every handler gets; only `payload` changes per hook. */
export const hookEventSchema = z.object({
  version: z.literal(HOOK_EVENT_VERSION),
  /** Unique per dispatch: the idempotency key. */
  id: z.uuid(),
  hook: hookNameSchema,
  occurredAt: z.iso.datetime(),
  /** What this handler's reply may do; empty when it only observes. */
  actions: z.array(hookActionSchema),
  /** turn is 0 before the first LLM call. */
  run: z.object({ id: z.uuid(), sessionId: z.uuid(), turn: z.number().int(), status: agentRunStatusSchema }),
  agent: z.object({ id: z.uuid(), name: z.string() }),
  user: z.object({
    userId: z.uuid().nullable(),
    appId: z.uuid().nullable(),
    externalUserId: z.string().nullable(),
    name: z.string().nullable(),
  }),
  /** The agent's settings for this plugin. */
  settings: jsonObjectSchema,
  /** What this plugin stored earlier in the run; other plugins don't see it. */
  state: jsonObjectSchema,
  payload: z.unknown(),
});
/** Discriminated by `hook`, so narrowing it types the payload. */
export type HookEvent<K extends HookName = HookName> = {
  [H in K]: Omit<z.infer<typeof hookEventSchema>, "hook" | "payload"> & { hook: H; payload: HookPayload<H> };
}[K];

/**
 * A handler's reply. Which actions a hook accepts, and the shape of `payload`
 * and `result`, are checked per hook by the runner. `state` is merged into
 * the plugin's run state.
 */
export const hookResultSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("continue") }),
    z.object({ action: z.literal("modify"), payload: jsonObjectSchema }),
    z.object({ action: z.literal("deny"), reason: z.string() }),
    z.object({ action: z.literal("respond"), result: z.unknown() }),
    z.object({ action: z.literal("stop"), reason: z.string() }),
  ])
  .and(z.object({ state: jsonObjectSchema.optional() }));
export type HookResult = z.infer<typeof hookResultSchema>;

// --- the hooks capability --------------------------------------------------

/** Where a handler runs among the handlers of the same hook; ties go by plugin position. */
export const hookOrderSchema = z.enum(["first", "default", "last"]);
export type HookOrder = z.infer<typeof hookOrderSchema>;

/** What a handler that errors or times out does to the step; `deny` is for tool.before only. */
export const hookOnFailureSchema = z.enum(["continue", "deny", "stop"]);
export type HookOnFailure = z.infer<typeof hookOnFailureSchema>;

/** How a plugin's handler runs on one or more hooks. */
export const hookHandlerSchema = z
  .object({
    /** A hook or a list of them. */
    hook: z.union([hookNameSchema, z.array(hookNameSchema).min(1)]),
    /** Empty: it only observes. */
    actions: z.array(hookActionSchema).default([]),
    /** Not waited for: gets the final payload, its reply is ignored. */
    background: z.boolean().default(false),
    onFailure: hookOnFailureSchema.default("continue"),
    /** The agent can turn it off. */
    optional: z.boolean().default(false),
    /** Defaults to DEFAULT_HOOK_TIMEOUT_MS, or DEFAULT_BACKGROUND_HOOK_TIMEOUT_MS in background. */
    timeoutMs: z.number().int().min(1).max(MAX_HOOK_TIMEOUT_MS).optional(),
    order: hookOrderSchema.default("default"),
  })
  .transform((handler) => ({
    ...handler,
    timeoutMs: handler.timeoutMs ?? (handler.background ? DEFAULT_BACKGROUND_HOOK_TIMEOUT_MS : DEFAULT_HOOK_TIMEOUT_MS),
  }));
export type HookHandler = z.output<typeof hookHandlerSchema>;

/** The hooks a handler runs on, in loop order. */
function hooksOf(handler: HookHandler): HookName[] {
  const { hook } = handler;
  const names = typeof hook === "string" ? [hook] : hook;
  return hookNameSchema.options.filter((name) => names.includes(name));
}

/** A plugin's `hooks` capability: one driver for every hook, and how each one runs. */
export const hooksCapabilitySchema = driverSchema
  .extend({ handlers: z.array(hookHandlerSchema).min(1) })
  .superRefine(({ handlers }, ctx) => {
    const seen = new Set<HookName>();
    handlers.forEach((handler, index) => {
      const issue = (message: string) => ctx.addIssue({ code: "custom", message, path: ["handlers", index] });
      if (handler.background && handler.actions.length) issue("a background handler can't have actions");
      for (const hook of hooksOf(handler)) {
        if (seen.has(hook)) issue(`two handlers on ${hook}`);
        seen.add(hook);
        const accepted: readonly HookAction[] = HOOKS[hook].actions;
        for (const action of handler.actions) {
          if (!accepted.includes(action)) issue(`${hook} doesn't accept ${action}`);
        }
        if (handler.onFailure === "deny" && hook !== "tool.before") issue(`onFailure "deny" on ${hook}`);
      }
    });
  });
export type HooksCapability = z.output<typeof hooksCapabilitySchema>;

/** The capability's handler per hook, lists expanded, in loop order. */
export function hookHandlersOf(capability: Pick<HooksCapability, "handlers">): Map<HookName, HookHandler> {
  const byHook = new Map<HookName, HookHandler>();
  for (const handler of capability.handlers) for (const hook of hooksOf(handler)) byHook.set(hook, handler);
  return new Map(hookNameSchema.options.flatMap((hook) => (byHook.has(hook) ? [[hook, byHook.get(hook)!]] : [])));
}
