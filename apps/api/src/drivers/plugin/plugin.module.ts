import { PluginDriverRegistry, PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";
import { HttpHealthCheckDriver } from "#src/drivers/http.health.js";
import { env } from "#src/env.js";
import { loadManifests } from "#src/infra/manifest/load-manifest.js";
import { Logger, Module } from "@nestjs/common";
import { pluginManifestSchema } from "@snipet/shared/core";
import { resolve } from "node:path";

import { DebugFsDriver } from "./providers/debug/fs.hooks.js";
import { DebugS3HealthCheckDriver } from "./providers/debug/s3.health.js";
import { DebugS3Driver } from "./providers/debug/s3.hooks.js";
import { MCPInstructionsDriver } from "./providers/mcp/mcp.instructions.js";
import { MCPToolsDriver } from "./providers/mcp/mcp.tools.js";
import { StaticInstructionsDriver } from "./providers/static/static.instructions.js";

@Module({
  providers: [
    {
      provide: PluginDriverRegistry,
      useFactory: () => {
        return new PluginDriverRegistry({
          tools: [new MCPToolsDriver()],
          instructions: [new MCPInstructionsDriver(), new StaticInstructionsDriver()],
          hooks: [new DebugFsDriver(), new DebugS3Driver()],
          healthCheck: [new HttpHealthCheckDriver(), new DebugS3HealthCheckDriver()],
        });
      },
    },
    {
      provide: PluginManifestRegistry,
      useFactory: async (drivers: PluginDriverRegistry) => {
        const registry = new PluginManifestRegistry(
          "plugin",
          loadManifests([env.PLUGINS_DIR, resolve(import.meta.dirname, "./manifests")]),
          pluginManifestSchema,
          drivers,
          new Logger("PluginManifestRegistry"),
        );
        await registry.init();
        return registry;
      },
      inject: [PluginDriverRegistry],
    },
  ],
  exports: [PluginDriverRegistry, PluginManifestRegistry],
})
export class PluginModule {}
