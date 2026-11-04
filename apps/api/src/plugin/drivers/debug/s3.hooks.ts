import { Driver } from "#src/manifest/driver.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ALL_HOOKS } from "@snipet/shared";

import { debugPath, eventJson } from "./event-file.js";
import { S3ConnectionOptions, s3ConnectionSchema, safeS3Client } from "./s3-client.js";

import type { HookEvent, HookResult } from "@snipet/shared";
import type { HookContext, HookDriver } from "../../driver.js";

/** Saves each event as a JSON object in the connection's bucket; only observes. */
export class DebugS3Driver extends Driver(s3ConnectionSchema) implements HookDriver<S3ConnectionOptions> {
  readonly key = "debug-s3";
  readonly hooks = ALL_HOOKS;

  async handle(event: HookEvent, options: S3ConnectionOptions, { signal }: HookContext): Promise<HookResult> {
    // ponytail: one client per event, cache per connection if the TLS handshakes ever show up.
    const client = await safeS3Client(options);
    await client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.prefix + debugPath(event),
        Body: eventJson(event),
        ContentType: "application/json",
      }),
      { abortSignal: AbortSignal.any([signal, AbortSignal.timeout(options.timeout * 1000)]) },
    );
    return { action: "continue" };
  }
}
