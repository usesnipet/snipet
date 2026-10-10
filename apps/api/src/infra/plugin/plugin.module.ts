import { Module } from "@nestjs/common";

import { env } from "../../env.js";

import { DriverRegistry } from "./driver.registry.js";
import { HttpHealthCheckDriver } from "./drivers/http.health.js";
import { McpActionDriver } from "./drivers/mcp.action.js";
import { PluginRegistry } from "./plugin.registry.js";

@Module({
  providers: [
    {
      provide: DriverRegistry,
      useFactory: () =>
        new DriverRegistry({ actions: [new McpActionDriver()], healthChecks: [new HttpHealthCheckDriver()] }),
    },
    {
      provide: PluginRegistry,
      useFactory: (drivers: DriverRegistry) => new PluginRegistry(env.PLUGINS_DIR, drivers),
      inject: [DriverRegistry],
    },
  ],
  exports: [DriverRegistry, PluginRegistry],
})
export class PluginModule {}
