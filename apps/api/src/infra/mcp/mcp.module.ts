import { Module } from "@nestjs/common";

import { McpConnector } from "./connector.js";

@Module({
  providers: [McpConnector],
  exports: [McpConnector],
})
export class McpModule {}
