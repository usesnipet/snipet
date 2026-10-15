import { env } from "#src/env.js";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

import { Storage } from "./storage.js";
import { assertKey, storagePath } from "./utils.js";

import type { Readable } from "node:stream";
import type { StoredFile } from "./storage.js";

// Objects under STORAGE_S3_PREFIX + <prefix>/ of one bucket.
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

  private key(prefix: string, key?: string) {
    return env.STORAGE_S3_PREFIX + storagePath(prefix, key);
  }

  async put(prefix: string, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.key(prefix, key), Body: body, ContentType: contentType }),
    );
  }

  async get(prefix: string, key: string): Promise<StoredFile | null> {
    try {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(prefix, key) }));
      return { body: object.Body as Readable, contentType: object.ContentType };
    } catch (error) {
      if ((error as Error).name === "NoSuchKey") return null;
      throw error;
    }
  }

  async delete(prefix: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(prefix, key) }));
  }

  async list(prefix: string, dir?: string): Promise<string[]> {
    const base = `${this.key(prefix, dir)}/`;
    const names: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: base, Delimiter: "/", ContinuationToken: token }),
      );
      for (const { Prefix } of page.CommonPrefixes ?? []) if (Prefix) names.push(Prefix.slice(base.length, -1));
      for (const { Key } of page.Contents ?? []) if (Key) names.push(Key.slice(base.length));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return names;
  }

  // Lists and deletes a page (up to 1000 keys) at a time until nothing is left.
  async deleteDir(prefix: string, dir: string): Promise<void> {
    assertKey(dir); // an empty dir would wipe the whole prefix
    const base = `${this.key(prefix, dir)}/`;
    let truncated: boolean | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: base }));
      const objects = (page.Contents ?? []).flatMap(({ Key }) => (Key ? [{ Key }] : []));
      if (objects.length === 0) return;
      const { Errors } = await this.client.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: true } }),
      );
      if (Errors?.length) throw new Error(`delete ${base}: ${Errors[0].Key} ${Errors[0].Message}`);
      truncated = page.IsTruncated;
    } while (truncated);
  }
}
