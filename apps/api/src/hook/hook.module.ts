import { env } from "#src/env.js";
import { HttpHealthCheckDriver } from "#src/manifest/drivers/http.health.js";
import { Module } from "@nestjs/common";
import { hookManifestSchema } from "@snipet/shared";
import { resolve } from "node:path";

import { WebhookDriver } from "./drivers/webhook.js";
import { HookDriverRegistry, HookRegistry } from "./hook.registry.js";

@Module({
  providers: [
    {
      provide: HookDriverRegistry,
      useFactory: () =>
        new HookDriverRegistry({
          handle: [new WebhookDriver()],
          healthCheck: [new HttpHealthCheckDriver()],
        }),
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
