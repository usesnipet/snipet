import { env } from "#src/env.js";
import { Injectable } from "@nestjs/common";
import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { Storage } from "./storage.js";
import { assertKey } from "./utils.js";

import type { StoredFile } from "./storage.js";

// Files under STORAGE_FS_DIR, one per key.
@Injectable()
export class FsStorage extends Storage {
  protected root = env.STORAGE_FS_DIR;

  private path(key: string) {
    assertKey(key);
    return join(this.root, key);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<StoredFile | null> {
    try {
      const handle = await open(this.path(key));
      return { body: handle.createReadStream() };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
