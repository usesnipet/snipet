import { S3Client } from "@aws-sdk/client-s3";

import type { S3ClientConfig } from "@aws-sdk/client-s3";

/** Where and how to reach a bucket; no access key means the SDK's default credentials. */
export interface S3Connection {
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  requestHandler?: S3ClientConfig["requestHandler"];
}

/** An S3 client for AWS or, with an endpoint, an S3-compatible service. */
export function createS3Client(connection: S3Connection): S3Client {
  const { region, endpoint, forcePathStyle, accessKeyId, secretAccessKey, requestHandler } = connection;
  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    requestHandler,
    credentials: accessKeyId ? { accessKeyId, secretAccessKey: secretAccessKey ?? "" } : undefined,
    // Many S3-compatible services reject the SDK's default CRC checksums.
    ...(endpoint ? { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" } : {}),
  });
}
