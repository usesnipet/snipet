import type { Readable } from "node:stream";

export interface StoredFile {
  body: Readable;
  contentType?: string;
}

/**
 * Where files live, split by prefix: each user of the storage owns one
 * ("files", ...) and only deals with keys inside it. Also the DI token: the
 * module binds it to the driver picked by STORAGE_DRIVER.
 */
export abstract class Storage {
  abstract put(prefix: string, key: string, body: Buffer, contentType: string): Promise<void>;
  abstract get(prefix: string, key: string): Promise<StoredFile | null>;
  abstract delete(prefix: string, key: string): Promise<void>;
  abstract list(prefix: string, dir?: string): Promise<string[]>;
  abstract deleteDir(prefix: string, dir: string): Promise<void>;
}
