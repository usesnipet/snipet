import { Module } from "@nestjs/common";

import { env } from "#src/env.js";

import { FsStorage } from "./fs-storage.js";
import { S3Storage } from "./s3-storage.js";
import { Storage } from "./storage.js";

@Module({
  providers: [{ provide: Storage, useClass: env.STORAGE_DRIVER === "s3" ? S3Storage : FsStorage }],
  exports: [Storage],
})
export class StorageModule {}
