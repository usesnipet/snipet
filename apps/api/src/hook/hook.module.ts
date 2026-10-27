import { env } from "#src/env.js";
import { StorageModule } from "#src/infra/storage/storage.module.js";
import { Storage } from "#src/infra/storage/storage.js";
import { HttpHealthCheckDriver } from "#src/manifest/drivers/http.health.js";
import { Module } from "@nestjs/common";
import { hookManifestSchema } from "@snipet/shared";
import { resolve } from "node:path";

import { DebugDriver } from "./drivers/debug.js";
import { WebhookDriver } from "./drivers/webhook.js";
import { HookDriverRegistry, HookRegistry } from "./hook.registry.js";

@Module({
  imports: [StorageModule],
  providers: [
    {
      provide: HookDriverRegistry,
      useFactory: (storage: Storage) =>
        new HookDriverRegistry({
          handle: [new WebhookDriver(), new DebugDriver(storage)],
          healthCheck: [new HttpHealthCheckDriver()],
        }),
      inject: [Storage],
    },
    {
      provide: HookRegistry,
      useFactory: (drivers: HookDriverRegistry) =>
        new HookRegistry(
          "hook",
          env.HOOKS_DIR,
          resolve(import.meta.dirname, "./manifests"),
          hookManifestSchema,
          drivers,
        ),
      inject: [HookDriverRegistry],
    },
  ],
  exports: [HookDriverRegistry, HookRegistry],
})
export class HookModule {}
