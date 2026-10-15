import { Module } from "@nestjs/common";

import { StorageModule } from "#src/infra/storage/storage.module.js";

import { FilesController } from "./files.controller.js";
import { FilesStorage } from "./files.storage.js";

@Module({
  imports: [StorageModule],
  controllers: [FilesController],
  providers: [FilesStorage],
  exports: [FilesStorage],
})
export class FilesModule {}
