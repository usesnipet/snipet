import { jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { McpTransport, ToolSource } from "@snipet/shared";

import { ToolService } from "./tool.service.js";

import type { McpConnector } from "../../infra/mcp/connector.js";
import type { McpServerService } from "../mcp-server/mcp-server.service.js";
import type { Tool } from "./tool.entity.js";
import type { Repository } from "typeorm";

type Fn = (...args: unknown[]) => Promise<unknown>;
const resolves = (value: unknown) => jest.fn<Fn>().mockResolvedValue(value);
const rejects = (err: Error) => jest.fn<Fn>().mockRejectedValue(err);

const greet = {
  id: "tool-1",
  name: "greet",
  source: ToolSource.MCP,
  mcpServerId: "server-1",
  inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
} as Partial<Tool>;
const server = { id: "server-1", transport: McpTransport.STDIO, config: { command: "npx" } };

function setup(tool: Partial<Tool> = greet, callTool = resolves({ content: "hi ana", isError: false })) {
  const repo = { findOneBy: resolves(tool), metadata: { name: "Tool" } };
  const servers = { findById: resolves(server) };
  const service = new ToolService(
    repo as unknown as Repository<Tool>,
    servers as unknown as McpServerService,
    { callTool } as unknown as McpConnector,
  );
  return { service, callTool };
}

describe("ToolService.execute", () => {
  it("calls the tool on its server", async () => {
    const { service, callTool } = setup();
    await expect(service.execute("tool-1", { name: "ana" })).resolves.toEqual({ content: "hi ana", isError: false });
    expect(callTool).toHaveBeenCalledWith(McpTransport.STDIO, server.config, "greet", { name: "ana" });
  });

  it("returns an error result for invalid arguments", async () => {
    const { service, callTool } = setup();
    const result = await service.execute("tool-1", {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain("invalid arguments");
    expect(callTool).not.toHaveBeenCalled();
  });

  it("returns an error result when the server fails", async () => {
    const { service } = setup(greet, rejects(new Error("connect: timeout")));
    await expect(service.execute("tool-1", { name: "ana" })).resolves.toEqual({
      content: "connect: timeout",
      isError: true,
    });
  });

  it("rejects a non-mcp tool", async () => {
    const { service } = setup({ ...greet, source: ToolSource.NATIVE, mcpServerId: null });
    await expect(service.execute("tool-1", {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
