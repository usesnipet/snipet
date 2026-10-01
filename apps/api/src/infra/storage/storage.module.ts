import { Module } from "@nestjs/common";

import { S3Source } from "./s3-source.js";

@Module({
  providers: [S3Source],
  exports: [S3Source],
})
export class StorageModule {}
