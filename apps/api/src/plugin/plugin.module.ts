import { Module } from "@nestjs/common";
import { pluginManifestSchema } from "@snipet/shared";

import { env } from "#src/env.js";
import { HttpHealthCheckDriver } from "#src/manifest/drivers/http.health.js";

import { McpActionDriver } from "./drivers/mcp.action.js";
import { PluginDriverRegistry, PluginRegistry } from "./plugin.registry.js";

@Module({
  providers: [
    {
      provide: PluginDriverRegistry,
      useFactory: () =>
        new PluginDriverRegistry({ actions: [new McpActionDriver()], healthCheck: [new HttpHealthCheckDriver()] }),
    },
    {
      provide: PluginRegistry,
      useFactory: (drivers: PluginDriverRegistry) =>
        new PluginRegistry("plugin", env.PLUGINS_DIR, pluginManifestSchema, drivers),
      inject: [PluginDriverRegistry],
    },
  ],
  exports: [PluginDriverRegistry, PluginRegistry],
})
export class PluginModule {}
