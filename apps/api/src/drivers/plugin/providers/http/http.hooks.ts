import { Driver } from "#src/core/manifest/driver.js";
import { safeFetch } from "#src/infra/http/safe-fetch.js";
import { ALL_HOOKS } from "@snipet/shared/core";
import { z } from "zod";

import type { HookContext, HookDriver } from "#src/core/plugin/driver.js";
import type { HookEvent, HookResult } from "@snipet/shared/core";

const optionsSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  headers: z.record(z.string(), z.string()).optional(),
});
type HttpHooksOptions = z.infer<typeof optionsSchema>;

/**
 * Posts each event as JSON to a URL; the response body is the handler's reply.
 * The runner validates the reply against the hook's result schema, so the
 * service may answer any action the hook accepts.
 */
export class HttpHooksDriver extends Driver(optionsSchema) implements HookDriver<HttpHooksOptions> {
  readonly key = "http";
  readonly hooks = ALL_HOOKS;

  async handle(event: HookEvent, { url, headers }: HttpHooksOptions, { signal }: HookContext): Promise<HookResult> {
    const response = await safeFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(event),
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as HookResult;
  }
}
