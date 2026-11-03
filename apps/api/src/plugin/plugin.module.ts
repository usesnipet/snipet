import { env } from "#src/env.js";
import { StorageModule } from "#src/infra/storage/storage.module.js";
import { Storage } from "#src/infra/storage/storage.js";
import { HttpHealthCheckDriver } from "#src/manifest/drivers/http.health.js";
import { Module } from "@nestjs/common";
import { pluginManifestSchema } from "@snipet/shared";
import { resolve } from "node:path";

import { DebugDriver } from "./drivers/debug.hooks.js";
import { McpDriver } from "./drivers/mcp.js";
import { StaticInstructionsDriver } from "./drivers/static.instructions.js";
import { WebhookDriver } from "./drivers/webhook.hooks.js";
import { PluginDriverRegistry, PluginRegistry } from "./plugin.registry.js";

@Module({
  imports: [StorageModule],
  providers: [
    {
      provide: PluginDriverRegistry,
      useFactory: (storage: Storage) => {
        const mcp = new McpDriver();
        return new PluginDriverRegistry({
          tools: [mcp],
          instructions: [mcp, new StaticInstructionsDriver()],
          hooks: [new DebugDriver(storage), new WebhookDriver()],
          healthCheck: [new HttpHealthCheckDriver()],
        });
      },
      inject: [Storage],
    },
    {
      provide: PluginRegistry,
      useFactory: (drivers: PluginDriverRegistry) =>
        new PluginRegistry(
          "plugin",
          env.PLUGINS_DIR,
          resolve(import.meta.dirname, "./manifests"),
          pluginManifestSchema,
          drivers,
        ),
      inject: [PluginDriverRegistry],
    },
  ],
  exports: [PluginDriverRegistry, PluginRegistry],
})
export class PluginModule {}
