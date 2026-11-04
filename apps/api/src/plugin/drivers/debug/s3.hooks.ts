import { Driver } from "#src/manifest/driver.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ALL_HOOKS } from "@snipet/shared";
import { z } from "zod";

import { debugPath, eventJson } from "./event-file.js";
import { s3ConnectionSchema, safeS3Client } from "./s3-client.js";

import type { HookEvent, HookResult } from "@snipet/shared";
import type { HookContext, HookDriver } from "../../driver.js";

const optionsSchema = s3ConnectionSchema.extend({ prefix: z.string() });

type DebugS3Options = z.infer<typeof optionsSchema>;

/** Saves each event as a JSON object in the connection's bucket; only observes. */
export class DebugS3Driver extends Driver(optionsSchema) implements HookDriver<DebugS3Options> {
  readonly key = "debug-s3";
  readonly hooks = ALL_HOOKS;

  async handle(event: HookEvent, options: DebugS3Options, { signal }: HookContext): Promise<HookResult> {
    // ponytail: one client per event, cache per connection if the TLS handshakes ever show up.
    const client = await safeS3Client(options);
    await client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.prefix + debugPath(event),
        Body: eventJson(event),
        ContentType: "application/json",
      }),
      { abortSignal: signal },
    );
    return { action: "continue" };
  }
}
