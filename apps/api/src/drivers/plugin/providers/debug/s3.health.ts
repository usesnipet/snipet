import { BlockedAddressError } from "#src/infra/http/safe-fetch.js";
import { Driver } from "#src/core/manifest/driver.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

import { S3ConnectionOptions, s3ConnectionSchema, safeS3Client } from "./s3-client.js";

import type { HealthCheckDriver, HealthCheckResult } from "#src/core/manifest/health-check.js";

/** Why HeadBucket failed. Its responses have no body, so the SDK's own message is often just "UnknownError". */
function describeFailure(err: unknown, { bucket, region, timeout }: S3ConnectionOptions): string {
  if (err instanceof BlockedAddressError) return `endpoint not allowed: ${err.message}`;
  const { name, message, $metadata } = err as Error & { $metadata?: { httpStatusCode?: number } };
  if (name === "AbortError" || name === "TimeoutError") return `no answer within ${timeout}s`;
  switch ($metadata?.httpStatusCode) {
    case 301:
      return `bucket "${bucket}" is not in region "${region}"`;
    case 403:
      return `access denied to bucket "${bucket}": check the credentials and the s3:ListBucket permission`;
    case 404:
      return `bucket "${bucket}" not found`;
    default:
      return message;
  }
}

/** Healthy when the bucket exists and the credentials can see it; says nothing about writing to it. */
export class DebugS3HealthCheckDriver
  extends Driver(s3ConnectionSchema)
  implements HealthCheckDriver<S3ConnectionOptions>
{
  readonly key = "debug-s3";

  async checkHealth(options: S3ConnectionOptions): Promise<HealthCheckResult> {
    try {
      const client = await safeS3Client(options);
      await client.send(new HeadBucketCommand({ Bucket: options.bucket }), {
        abortSignal: AbortSignal.timeout(options.timeout * 1000),
      });
      return { isHealthy: true };
    } catch (err) {
      return { isHealthy: false, error: describeFailure(err, options) };
    }
  }
}
