import { InstructionsDriver } from "#src/core/plugin/driver.js";

import { MCPDriver, MCPOptions } from "./mcp.base.js";

export class MCPInstructionsDriver extends MCPDriver implements InstructionsDriver<MCPOptions> {
  getInstructions(_connectionId: string, options: MCPOptions): Promise<string | undefined> {
    return this.withSession(options, (client) => Promise.resolve(client.getInstructions()));
  }
}
