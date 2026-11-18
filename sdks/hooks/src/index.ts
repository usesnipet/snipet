import { HookAction, hookEventSchemaOf, hookNameSchema } from "@snipet/shared/core";
import { z } from "zod";

import type { HookEvent, HookName, HookResult } from "@snipet/shared/core";

export { HOOK_ACTIONS, HOOKS, HookAction, HookName, HookToolErrorReason, hookEventSchemaOf } from "@snipet/shared/core";
export type { HookEvent, HookPayload, HookResult } from "@snipet/shared/core";

/** One function per hook the service handles; a hook without one goes on unchanged. */
export type HookHandlers = {
  [K in HookName]?: (event: HookEvent<K>) => HookResult<K> | Promise<HookResult<K>>;
};

/** The request body is not a hook event; the request handler answers it with 400. */
export class InvalidHookEventError extends Error {}

/**
 * Validates `body` as a hook event and runs its handler. For servers that
 * already parse JSON (Express, Nest, Fastify): reply with the result as JSON.
 */
export async function handleHook(handlers: HookHandlers, body: unknown): Promise<HookResult> {
  const name = (body as { hook?: unknown } | null)?.hook;
  if (typeof name !== "string") throw new InvalidHookEventError("missing hook");
  const hook = hookNameSchema.safeParse(name);
  // A hook newer than this SDK, or one the service doesn't handle, goes on unchanged.
  if (!hook.success || !handlers[hook.data]) return { action: HookAction.CONTINUE };
  const event = hookEventSchemaOf(hook.data).safeParse(body);
  if (!event.success) throw new InvalidHookEventError(z.prettifyError(event.error));
  const handler = handlers[hook.data] as (event: HookEvent) => HookResult | Promise<HookResult>;
  return handler(event.data);
}

/**
 * A fetch-style handler (Hono, Next.js, Bun, Deno, Workers) for the URL the
 * plugin's `http` driver posts to. A handler that throws becomes a 500, which
 * the runner treats per the hook's `onFailure`.
 */
export function createHookHandler(handlers: HookHandlers): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
    try {
      return Response.json(await handleHook(handlers, await request.json()));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof InvalidHookEventError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  };
}
