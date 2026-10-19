import { env } from "#src/env.js";
import { Injectable } from "@nestjs/common";
import { mkdir, open, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { Storage } from "./storage.js";
import { assertKey, storagePath } from "./utils.js";

import type { StoredFile } from "./storage.js";

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

@Injectable()
export class FsStorage extends Storage {
  protected root = env.STORAGE_FS_DIR;

  private path(prefix: string, key?: string) {
    return join(this.root, storagePath(prefix, key));
  }

  async put(prefix: string, key: string, body: Buffer): Promise<void> {
    const path = this.path(prefix, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(prefix: string, key: string): Promise<StoredFile | null> {
    try {
      const handle = await open(this.path(prefix, key));
      return { body: handle.createReadStream() };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async delete(prefix: string, key: string): Promise<void> {
    await rm(this.path(prefix, key), { force: true });
  }

  async list(prefix: string, dir?: string): Promise<string[]> {
    try {
      return await readdir(this.path(prefix, dir));
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  async deleteDir(prefix: string, dir: string): Promise<void> {
    assertKey(dir); // an empty dir would wipe the whole prefix
    await rm(this.path(prefix, dir), { recursive: true, force: true });
  }
}
