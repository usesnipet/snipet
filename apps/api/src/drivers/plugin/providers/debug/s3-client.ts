import { resolvePublic, safeAgents } from "#src/infra/http/safe-fetch.js";
import { createS3Client } from "#src/infra/storage/s3-client.js";
import { isIP } from "node:net";
import { z } from "zod";

import type { S3Client } from "@aws-sdk/client-s3";

/** The options every debug S3 driver takes to reach the connection's bucket. */
export const s3ConnectionSchema = z.strictObject({
  bucket: z.string().min(1),
  region: z.string().min(1),
  endpoint: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]),
  forcePathStyle: z.boolean(),
  // Required: without them the SDK would fall back to the API server's own AWS credentials.
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  timeout: z.number().int().min(1).max(60), // seconds
  prefix: z.string(),
});

export type S3ConnectionOptions = z.infer<typeof s3ConnectionSchema>;

/**
 * A client that only reaches public addresses or OUTBOUND_ALLOWLIST. Names are
 * checked by the agents' lookup when the socket connects, under the request's
 * signal; Node skips that lookup for an IP literal, so a literal is checked here.
 */
export async function safeS3Client(options: S3ConnectionOptions): Promise<S3Client> {
  const { endpoint } = options;
  if (endpoint) {
    const { hostname } = new URL(endpoint);
    if (isIP(hostname.replace(/^\[|\]$/g, ""))) await resolvePublic(hostname);
  }
  return createS3Client({ ...options, endpoint: endpoint || undefined, requestHandler: safeAgents });
}
