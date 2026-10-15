import { Module } from "@nestjs/common";

import { env } from "#src/env.js";

import { FsStorage } from "./fs-storage.js";
import { S3Source } from "./s3-source.js";
import { S3Storage } from "./s3-storage.js";
import { Storage } from "./storage.js";

@Module({
  providers: [S3Source, { provide: Storage, useClass: env.STORAGE_DRIVER === "s3" ? S3Storage : FsStorage }],
  exports: [S3Source, Storage],
})
export class StorageModule {}
