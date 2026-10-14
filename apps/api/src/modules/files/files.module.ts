import { Module } from "@nestjs/common";

import { StorageModule } from "#src/infra/storage/storage.module.js";

import { FilesController } from "./files.controller.js";

@Module({
  imports: [StorageModule],
  controllers: [FilesController],
})
export class FilesModule {}
