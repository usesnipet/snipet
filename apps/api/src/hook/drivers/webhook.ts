import { Driver } from "#src/manifest/driver.js";
import { hookResultSchema } from "@snipet/shared";
import { createHmac } from "node:crypto";
import { z } from "zod";

import type { HookEvent, HookResult } from "@snipet/shared";
import type { HookDriver } from "../driver.js";

/** Largest reply body read from the webhook. */
const MAX_RESPONSE_BYTES = 1_000_000;

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
export function sign(secret: string, body: string, now = Date.now()): string {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
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
    const res = await fetch(url, {
      method: "POST",
      body,
      signal,
      // A redirect could point the signed event somewhere the connection didn't name.
      redirect: "error",
      headers: {
        // Unset connection fields render as "": drop them instead of sending empty headers.
        ...Object.fromEntries(Object.entries(headers ?? {}).filter(([, v]) => v)),
        "Content-Type": "application/json",
        "X-Snipet-Event-Id": event.id,
        "X-Snipet-Hook": event.hook,
        ...(signingSecret ? { "X-Snipet-Signature": sign(signingSecret, body) } : {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("reply too large");
    if (!text.trim()) return { action: "continue" };

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("reply is not JSON");
    }
    const result = hookResultSchema.safeParse(raw);
    // Issues only, never the body: the reply is untrusted.
    if (!result.success) throw new Error(`invalid reply: ${result.error.issues.map((i) => i.message).join("; ")}`);
    return result.data;
  }
}
