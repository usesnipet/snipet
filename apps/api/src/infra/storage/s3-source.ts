import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

import { env } from "../../env.js";

export interface SourceObject {
  key: string;
  name: string;
  // The ETag, which changes whenever the content does.
  hash: string;
  size: number;
  lastModified: Date | null;
}

// Lists and reads the objects of the knowledge bucket (KNOWLEDGE_S3_*).
@Injectable()
export class S3Source {
  private readonly client = new S3Client({
    region: env.KNOWLEDGE_S3_REGION,
    endpoint: env.KNOWLEDGE_S3_ENDPOINT || undefined,
    forcePathStyle: env.KNOWLEDGE_S3_FORCE_PATH_STYLE,
    credentials: env.KNOWLEDGE_S3_ACCESS_KEY_ID
      ? { accessKeyId: env.KNOWLEDGE_S3_ACCESS_KEY_ID, secretAccessKey: env.KNOWLEDGE_S3_SECRET_ACCESS_KEY ?? "" }
      : undefined,
    // Many S3-compatible services reject the SDK's default CRC checksums.
    ...(env.KNOWLEDGE_S3_ENDPOINT
      ? { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }
      : {}),
  });
  private readonly bucket = env.KNOWLEDGE_S3_BUCKET;

  async *list(): AsyncGenerator<SourceObject> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: env.KNOWLEDGE_S3_PREFIX, ContinuationToken: token }),
      );
      for (const obj of page.Contents ?? []) {
        // Skip "folder" placeholder keys.
        if (!obj.Key || obj.Key.endsWith("/")) continue;
        yield {
          key: obj.Key,
          name: obj.Key.split("/").pop()!,
          hash: (obj.ETag ?? "").replaceAll('"', ""),
          size: obj.Size ?? 0,
          lastModified: obj.LastModified ?? null,
        };
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  async read(key: string): Promise<{ bytes: Uint8Array; contentType?: string }> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return { bytes: await out.Body!.transformToByteArray(), contentType: out.ContentType };
  }
}
