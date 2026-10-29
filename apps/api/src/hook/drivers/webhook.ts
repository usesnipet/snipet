import { safeFetch } from "#src/infra/http/safe-fetch.js";
import { Driver } from "#src/manifest/driver.js";
import { hookResultSchema } from "@snipet/shared";
import { createHmac } from "node:crypto";
import { z } from "zod";

import type { HookEvent, HookResult } from "@snipet/shared";
import type { HookDriver } from "../driver.js";

/** Largest reply body read from a webhook. */
const WEBHOOK_MAX_RESPONSE_BYTES = 1_000_000;

/** Headers a webhook request carries besides the connection's own. */
const WEBHOOK_HEADERS = {
  eventId: "X-Snipet-Event-Id",
  hook: "X-Snipet-Hook",
  signature: "X-Snipet-Signature",
} as const;

const optionsSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  headers: z.record(z.string(), z.string()).optional(),
  /** Empty when the connection has no secret: the request goes unsigned. */
  signingSecret: z.string().optional(),
});

type WebhookOptions = z.infer<typeof optionsSchema>;

/**
 * Stripe-style signature: `t=<unix>,v1=<hex hmac-sha256(secret, "<t>.<body>")>`.
 * The timestamp lets the receiver reject replays.
 */
export function sign(secret: string, body: string, now: number = Date.now()): string {
  const timestamp = Math.floor(now / 1000);
  const hmac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

/**
 * POSTs the event as JSON and uses the reply as the HookResult. A 204 or an
 * empty body is `continue`; a non-2xx status or a reply that isn't a
 * HookResult throws.
 */
export class WebhookDriver extends Driver(optionsSchema) implements HookDriver<WebhookOptions> {
  readonly key = "webhook";

  async handle(
    event: HookEvent,
    { url, headers, signingSecret }: WebhookOptions,
    signal: AbortSignal,
  ): Promise<HookResult> {
    const body = JSON.stringify(event);
    const response: Response = await safeFetch(url, {
      method: "POST",
      body,
      signal,
      // A redirect could point the signed event somewhere the connection didn't name.
      redirect: "error",
      headers: {
        // Unset connection fields render as "": drop them instead of sending empty headers.
        ...Object.fromEntries(Object.entries(headers ?? {}).filter(([, value]) => value)),
        "Content-Type": "application/json",
        [WEBHOOK_HEADERS.eventId]: event.id,
        [WEBHOOK_HEADERS.hook]: event.hook,
        ...(signingSecret ? { [WEBHOOK_HEADERS.signature]: sign(signingSecret, body) } : {}),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const replyText: string = await response.text();
    if (replyText.length > WEBHOOK_MAX_RESPONSE_BYTES) throw new Error("reply too large");
    if (!replyText.trim()) return { action: "continue" };

    let replyJson: unknown;
    try {
      replyJson = JSON.parse(replyText);
    } catch {
      throw new Error("reply is not JSON");
    }
    const parsed = hookResultSchema.safeParse(replyJson);
    // Issues only, never the body: the reply is untrusted.
    if (!parsed.success) {
      throw new Error(`invalid reply: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
    }
    return parsed.data;
  }
}
