import z from "zod";

import { jsonObjectSchema } from "../../../../schemas/json.js";
import { agentRunStatusSchema } from "../../../agent-run.js";
import { llmMessageSchema, llmToolCallPartSchema } from "../../llm/message.js";
import { llmResponseSchema, llmUsageSchema } from "../../llm/response.js";
import { llmStreamEventMetadataSchema } from "../../llm/stream.js";
import { llmTargetSchema } from "../../llm/target.js";
import { llmToolSchema, toolResultSchema } from "../../llm/tool.js";

// --- phases and actions ----------------------------------------------------

/** Which way a hook runs through the onion around the LLM and tools. */
export enum HookPhase {
  /** Handlers run in plugin order. */
  IN = "in",
  /** Handlers run in reverse plugin order, so the plugin nearest the LLM going in is nearest coming out. */
  OUT = "out",
}
export const hookPhaseSchema = z.enum(HookPhase);

/** What a handler's reply may do. */
export enum HookAction {
  /** Goes on unchanged; every hook accepts it. */
  CONTINUE = "continue",
  /** Merges into the payload (shallow), only the keys the hook lets change. */
  MODIFY = "modify",
  /** Skips a tool call, the model getting the reason. */
  DENY = "deny",
  /** Answers the step instead of running it. */
  RESPOND = "respond",
  /** Fails the run with the reason. */
  STOP = "stop",
}
export const hookActionSchema = z.enum(HookAction);

/** Why a tool call ended in an error result. */
export enum HookToolErrorReason {
  CANCELLED = "cancelled",
  ERROR_RESULT = "error_result",
  UNKNOWN_TOOL = "unknown_tool",
  DENIED = "denied",
}
export const hookToolErrorReasonSchema = z.enum(HookToolErrorReason);

// --- results ---------------------------------------------------------------

/** Merged into the plugin's run state, whatever the action. */
const state = jsonObjectSchema.optional();

/** Every hook accepts it: go on unchanged. */
const continueResult = z.object({ action: z.literal(HookAction.CONTINUE), state });

/** Fails the run with the reason. */
const stop = z.object({ action: z.literal(HookAction.STOP), reason: z.string(), state });

/** Skips a tool call, the model getting the reason. */
const deny = z.object({ action: z.literal(HookAction.DENY), reason: z.string(), state });

/** Answers the step with `result` instead of running it. */
function respond<R extends z.ZodType>(result: R) {
  return z.object({ action: z.literal(HookAction.RESPOND), result, state });
}

/**
 * Merges into the payload (shallow); only `keys` may change, and others are
 * rejected, not dropped, so a plugin learns it touched a read-only field.
 */
function modify<S extends z.ZodRawShape, K extends keyof S & string>(payload: z.ZodObject<S>, keys: readonly K[]) {
  const shape = Object.fromEntries(keys.map((key) => [key, payload.shape[key]])) as Pick<S, K>;
  return z.object({ action: z.literal(HookAction.MODIFY), payload: z.object(shape).partial().strict(), state });
}

/** The replies a hook accepts: `continue` plus `options`. */
function hookResult<const O extends readonly z.ZodObject[]>(...options: O) {
  return z.discriminatedUnion("action", [continueResult, ...options]);
}

// --- definitions -----------------------------------------------------------

/** A hook: its phase, the payload its handlers get, and the replies they may send. */
type HookDefinition = { phase: HookPhase; payload: z.ZodObject; result: z.ZodDiscriminatedUnion };

const userInput = z.string();
const messages = z.array(llmMessageSchema);
const tools = z.array(llmToolSchema);
const durationMs = z.number();
const error = z.string().nullable();

/** A target the run fell back from, as the llm_skipped stream event reports it. */
const skippedTargetSchema = z.object({ metadata: llmStreamEventMetadataSchema, model: z.string(), error: z.string() });

/** Every hook of the agent loop */
export enum HookName {
  RUN_START = "run.start",
  RUN_CONTEXT = "run.context",
  LLM_REQUEST = "llm.request",
  LLM_RESPONSE = "llm.response",
  TOOL_BEFORE = "tool.before",
  TOOL_AFTER = "tool.after",
  RUN_END = "run.end",
}
export const hookNameSchema = z.enum(HookName);

const runContextPayload = z.object({ userInput, messages, tools });
const llmRequestPayload = z.object({ messages, tools, targets: z.array(llmTargetSchema) });
const llmResponsePayload = llmResponseSchema.extend({
  model: z.string().nullable(),
  skipped: z.array(skippedTargetSchema),
  durationMs,
});
const toolBeforePayload = z.object({
  call: llmToolCallPartSchema,
  /** The plugin connection the tool belongs to; null for an unknown tool. */
  tool: z.object({ id: z.string(), name: z.string() }).nullable(),
});
const toolAfterPayload = z.object({
  call: llmToolCallPartSchema,
  result: toolResultSchema,
  durationMs,
  error,
  reason: hookToolErrorReasonSchema.optional(),
});

/** Each hook's definition. */
export const HOOKS = {
  [HookName.RUN_START]: {
    phase: HookPhase.IN,
    payload: z.object({ input: userInput }),
    result: hookResult(stop),
  },
  [HookName.RUN_CONTEXT]: {
    phase: HookPhase.IN,
    payload: runContextPayload,
    result: hookResult(modify(runContextPayload, ["userInput", "messages", "tools"]), stop),
  },
  [HookName.LLM_REQUEST]: {
    phase: HookPhase.IN,
    payload: llmRequestPayload,
    result: hookResult(modify(llmRequestPayload, ["messages", "tools", "targets"]), respond(llmMessageSchema), stop),
  },
  [HookName.LLM_RESPONSE]: {
    phase: HookPhase.OUT,
    payload: llmResponsePayload,
    result: hookResult(modify(llmResponsePayload, ["message"]), stop),
  },
  [HookName.TOOL_BEFORE]: {
    phase: HookPhase.IN,
    payload: toolBeforePayload,
    result: hookResult(modify(toolBeforePayload, ["call"]), respond(toolResultSchema), deny, stop),
  },
  [HookName.TOOL_AFTER]: {
    phase: HookPhase.OUT,
    payload: toolAfterPayload,
    result: hookResult(modify(toolAfterPayload, ["result"]), stop),
  },
  [HookName.RUN_END]: {
    phase: HookPhase.OUT,
    payload: z.object({
      status: agentRunStatusSchema,
      error,
      userInput,
      messages,
      turns: z.number().int(),
      usage: llmUsageSchema,
      durationMs,
    }),
    result: hookResult(),
  },
} as const satisfies Record<HookName, HookDefinition>;

export type HookPayload<K extends HookName> = z.infer<(typeof HOOKS)[K]["payload"]>;
/** A handler's reply on a hook. */
export type HookResult<K extends HookName = HookName> = z.infer<(typeof HOOKS)[K]["result"]>;

/** Every hook */
export const ALL_HOOKS: readonly HookName[] = hookNameSchema.options;

/** The actions each hook accepts, read off its result schema. */
export const HOOK_ACTIONS = {} as Record<HookName, readonly HookAction[]>;
for (const hook of ALL_HOOKS) {
  const options: readonly z.ZodObject<{ action: z.ZodLiteral<HookAction> }>[] = HOOKS[hook].result.options;
  HOOK_ACTIONS[hook] = options.map((option) => option.shape.action.value);
}

/** Plugins in the order their handlers run on a hook: as given going in, reversed coming out. */
export function inHookOrder<T>(hook: HookName, plugins: readonly T[]): T[] {
  return HOOKS[hook].phase === HookPhase.OUT ? plugins.toReversed() : [...plugins];
}
