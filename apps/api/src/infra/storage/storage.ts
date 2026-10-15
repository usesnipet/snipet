import { BadRequestException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Readable } from "node:stream";

export interface StoredFile {
  body: Readable;
  contentType?: string;
}

// Where uploaded files live. Also the DI token: the module binds it to the
// driver picked by STORAGE_DRIVER.
export abstract class Storage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** null when the key does not exist. */
  abstract get(key: string): Promise<StoredFile | null>;
  /** A missing key is not an error. */
  abstract delete(key: string): Promise<void>;

  // Stores a base64 image data URL under a fresh key in dir and returns the
  // key. Fresh keys let the files be cached forever.
  async putDataUrl(dir: string, dataUrl: string): Promise<string> {
    const re = /^data:image\/(png|jpeg|webp);base64,(.*)$/;
    const match = re.exec(dataUrl);
    if (!match) throw new BadRequestException("Expected a base64 PNG, JPEG or WebP image");
    const [, type, data] = match;
    const key = `${dir}/${randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
    await this.put(key, Buffer.from(data, "base64"), `image/${type}`);
    return key;
  }
}
