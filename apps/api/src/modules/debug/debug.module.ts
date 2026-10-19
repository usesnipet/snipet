import { Module } from "@nestjs/common";

import { StorageModule } from "#src/infra/storage/storage.module.js";

import { SettingsModule } from "../settings/settings.module.js";

import { DebugService } from "./debug.service.js";
import { DebugStorage } from "./debug.storage.js";

@Module({
  imports: [StorageModule, SettingsModule],
  providers: [DebugService, DebugStorage],
  exports: [DebugService],
})
export class DebugModule {}
