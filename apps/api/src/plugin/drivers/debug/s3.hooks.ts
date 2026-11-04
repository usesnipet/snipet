import { resolvePublic, safeAgents } from "#src/infra/http/safe-fetch.js";
import { createS3Client } from "#src/infra/storage/s3-client.js";
import { Driver } from "#src/manifest/driver.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ALL_HOOKS } from "@snipet/shared";
import { z } from "zod";

import { debugPath, eventJson } from "./event-file.js";

import type { HookEvent, HookResult } from "@snipet/shared";
import type { HookContext, HookDriver } from "../../driver.js";

const optionsSchema = z.strictObject({
  bucket: z.string().min(1),
  region: z.string().min(1),
  prefix: z.string(),
  endpoint: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]),
  forcePathStyle: z.boolean(),
  // Required: without them the SDK would fall back to the API server's own AWS credentials.
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
});

type DebugS3Options = z.infer<typeof optionsSchema>;

/** Saves each event as a JSON object in the connection's bucket; only observes. */
export class DebugS3Driver extends Driver(optionsSchema) implements HookDriver<DebugS3Options> {
  readonly key = "debug-s3";
  readonly hooks = ALL_HOOKS;

  async handle(event: HookEvent, options: DebugS3Options, { signal }: HookContext): Promise<HookResult> {
    const { bucket, prefix, endpoint } = options;
    // Node skips the agents' lookup for an IP literal, so a literal endpoint is checked here.
    if (endpoint) await resolvePublic(new URL(endpoint).hostname);
    // ponytail: one client per event, cache per connection if the TLS handshakes ever show up.
    const client = createS3Client({ ...options, endpoint: endpoint || undefined, requestHandler: safeAgents });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: prefix + debugPath(event),
        Body: eventJson(event),
        ContentType: "application/json",
      }),
      { abortSignal: signal },
    );
    return { action: "continue" };
  }
}
