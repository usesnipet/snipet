import { Storage } from "#src/infra/storage/storage.js";
import { Injectable } from "@nestjs/common";

const PREFIX = "debug";

@Injectable()
export class DebugStorage {
  constructor(private readonly storage: Storage) {}

  put(key: string, json: string): Promise<void> {
    return this.storage.put(PREFIX, key, Buffer.from(json), "application/json");
  }
}
