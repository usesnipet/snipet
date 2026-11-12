import z from "zod";

import { driverSchema } from "../../../../schemas/manifest.js";

import { HOOK_ACTIONS, HookAction, HookName, hookNameSchema } from "./hooks.js";

/** Timeout of a sequential handler without its own: it holds the run up. */
export const DEFAULT_HOOK_TIMEOUT_MS = 5_000;
/** Timeout of a background handler without its own: nothing waits for it. */
export const DEFAULT_BACKGROUND_HOOK_TIMEOUT_MS = 30_000;
/** Longest a handler may take. */
export const MAX_HOOK_TIMEOUT_MS = 30_000;

/** What a handler that errors or times out does to the step. */
export enum HookOnFailure {
  CONTINUE = "continue",
  /** Only on hooks that accept deny. */
  DENY = "deny",
  STOP = "stop",
}
export const hookOnFailureSchema = z.enum(HookOnFailure);

/** How the runner runs a handler among the others on its hook. */
export enum HookMode {
  /** Awaited in onion order, each getting the previous one's payload; may reply any action the hook accepts. */
  SEQUENTIAL = "sequential",
  /** Not awaited: gets a snapshot of the payload at its place in the onion, its reply ignored. */
  BACKGROUND = "background",
}
export const hookModeSchema = z.enum(HookMode);

/** How a plugin's handler runs on one hook; its reply may use any action the hook accepts (see HOOK_ACTIONS). */
export const hookHandlerSchema = z
  .object({
    mode: hookModeSchema.default(HookMode.SEQUENTIAL),
    onFailure: hookOnFailureSchema.default(HookOnFailure.CONTINUE),
    /** The agent can turn it off. */
    optional: z.boolean().default(false),
    /** Defaults to DEFAULT_HOOK_TIMEOUT_MS, or DEFAULT_BACKGROUND_HOOK_TIMEOUT_MS in background. */
    timeoutMs: z.number().int().min(1).max(MAX_HOOK_TIMEOUT_MS).optional(),
  })
  .transform((handler) => ({
    ...handler,
    timeoutMs:
      handler.timeoutMs ??
      (handler.mode === HookMode.BACKGROUND ? DEFAULT_BACKGROUND_HOOK_TIMEOUT_MS : DEFAULT_HOOK_TIMEOUT_MS),
  }));
export type HookHandler = z.output<typeof hookHandlerSchema>;

/** A plugin's `hooks` capability: one driver for every hook, and its handler per hook. */
export const hooksCapabilitySchema = driverSchema
  .extend({ handlers: z.partialRecord(hookNameSchema, hookHandlerSchema) })
  .superRefine(({ handlers }, ctx) => {
    const entries = Object.entries(handlers).filter(([, handler]) => handler) as [HookName, HookHandler][];
    if (!entries.length) ctx.addIssue({ code: "custom", message: "no handlers", path: ["handlers"] });
    for (const [hook, handler] of entries) {
      const issue = (message: string) => ctx.addIssue({ code: "custom", message, path: ["handlers", hook] });
      if (handler.onFailure === HookOnFailure.DENY && !HOOK_ACTIONS[hook].includes(HookAction.DENY)) {
        issue(`onFailure "deny" on ${hook}`);
      }
      if (handler.mode === HookMode.BACKGROUND && handler.onFailure !== HookOnFailure.CONTINUE) {
        issue(`onFailure "${handler.onFailure}" in background: nothing waits for it`);
      }
    }
  });
export type HooksCapability = z.output<typeof hooksCapabilitySchema>;
