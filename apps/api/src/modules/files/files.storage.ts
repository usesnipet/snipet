import { Storage } from "#src/infra/storage/storage.js";
import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { StoredFile } from "#src/infra/storage/storage.js";

const PREFIX = "files";

@Injectable()
export class FilesStorage {
  constructor(private readonly storage: Storage) {}

  get(key: string): Promise<StoredFile | null> {
    return this.storage.get(PREFIX, key);
  }

  delete(key: string): Promise<void> {
    return this.storage.delete(PREFIX, key);
  }

  // Stores a base64 image data URL under a fresh key in dir and returns the
  // key. Fresh keys let the files be cached forever.
  async putDataUrl(dir: string, dataUrl: string): Promise<string> {
    const re = /^data:image\/(png|jpeg|webp);base64,(.*)$/;
    const match = re.exec(dataUrl);
    if (!match) throw new BadRequestException("Expected a base64 PNG, JPEG or WebP image");
    const [, type, data] = match;
    const key = `${dir}/${randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
    await this.storage.put(PREFIX, key, Buffer.from(data, "base64"), `image/${type}`);
    return key;
  }
}
