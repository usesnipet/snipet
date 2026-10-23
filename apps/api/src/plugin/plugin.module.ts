import { env } from "#src/env.js";
import { HttpHealthCheckDriver } from "#src/manifest/drivers/http.health.js";
import { Module } from "@nestjs/common";
import { pluginManifestSchema } from "@snipet/shared";
import { resolve } from "node:path";

import { McpDriver } from "./drivers/mcp.js";
import { StaticInstructionsDriver } from "./drivers/static.instructions.js";
import { PluginDriverRegistry, PluginRegistry } from "./plugin.registry.js";

@Module({
  providers: [
    {
      provide: PluginDriverRegistry,
      useFactory: () => {
        const mcp = new McpDriver();
        return new PluginDriverRegistry({
          actions: [mcp],
          instructions: [mcp, new StaticInstructionsDriver()],
          healthCheck: [new HttpHealthCheckDriver()],
        });
      },
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
