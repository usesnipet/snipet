import { Storage } from "#src/infra/storage/storage.js";
import { Injectable } from "@nestjs/common";

// Never served: FilesController only reads the "files" prefix.
const PREFIX = "debug";

// The debug files, one JSON file per key.
@Injectable()
export class DebugStorage {
  constructor(private readonly storage: Storage) {}

  put(key: string, json: string): Promise<void> {
    return this.storage.put(PREFIX, key, Buffer.from(json), "application/json");
  }
}
