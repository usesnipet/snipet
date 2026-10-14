import { env } from "#src/env.js";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

import { Storage } from "./storage.js";
import { assertKey } from "./utils.js";

import type { Readable } from "node:stream";
import type { StoredFile } from "./storage.js";
@Injectable()
export class S3Storage extends Storage {
  private readonly client = new S3Client({
    region: env.STORAGE_S3_REGION,
    endpoint: env.STORAGE_S3_ENDPOINT || undefined,
    forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE,
    credentials: env.STORAGE_S3_ACCESS_KEY_ID
      ? { accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY ?? "" }
      : undefined,
    // Many S3-compatible services reject the SDK's default CRC checksums.
    ...(env.STORAGE_S3_ENDPOINT
      ? { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }
      : {}),
  });
  private readonly bucket = env.STORAGE_S3_BUCKET;

  private key(key: string) {
    assertKey(key);
    return env.STORAGE_S3_PREFIX + key;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.key(key), Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<StoredFile | null> {
    try {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) }));
      return { body: object.Body as Readable, contentType: object.ContentType };
    } catch (error) {
      if ((error as Error).name === "NoSuchKey") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(key) }));
  }
}
