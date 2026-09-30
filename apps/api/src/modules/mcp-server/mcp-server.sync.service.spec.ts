import { jest } from "@jest/globals";
import { McpTransport, ToolSource } from "@snipet/shared";

import { McpServerSyncService } from "./mcp-server.sync.service.js";

import type { McpConnector } from "./mcp/connector.js";
import type { McpServer } from "./mcp-server.entity.js";
import type { Repository } from "typeorm";

type Fn = (...args: unknown[]) => Promise<unknown>;
const resolves = (value: unknown) => jest.fn<Fn>().mockResolvedValue(value);
const rejects = (err: Error) => jest.fn<Fn>().mockRejectedValue(err);

function setup(listTools: () => Promise<unknown>) {
  const tools = {
    findBy: resolves([
      { id: "keep", name: "read_graph" },
      { id: "gone", name: "old_tool" },
    ]),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const servers = {
    findOneByOrFail: resolves({ id: "s1", transport: McpTransport.STDIO, config: { command: "npx" } }),
    update: jest.fn(),
    manager: { transaction: (fn: (m: unknown) => Promise<void>) => fn({ getRepository: () => tools }) },
  };
  const service = new McpServerSyncService(
    servers as unknown as Repository<McpServer>,
    { listTools } as unknown as McpConnector,
  );
  return { service, servers, tools };
}

describe("McpServerSyncService.syncServer", () => {
  it("updates, creates and deletes tools by name and clears the error", async () => {
    const { service, servers, tools } = setup(
      resolves([
        { name: "read_graph", description: "Read", inputSchema: { type: "object" } },
        { name: "new_tool", description: "New", inputSchema: { type: "object" } },
      ]),
    );

    await service.syncServer("s1");

    expect(tools.save).toHaveBeenCalledWith({ id: "keep", description: "Read", inputSchema: { type: "object" } });
    expect(tools.save).toHaveBeenCalledWith({
      name: "new_tool",
      description: "New",
      inputSchema: { type: "object" },
      source: ToolSource.MCP,
      mcpServerId: "s1",
    });
    expect(tools.delete).toHaveBeenCalledWith(["gone"]);
    expect(servers.update).toHaveBeenCalledWith("s1", expect.objectContaining({ lastSyncedError: null }));
  });

  it("keeps tools and records the error when the server is unreachable", async () => {
    const { service, servers, tools } = setup(rejects(new Error("spawn npx ENOENT")));

    await expect(service.syncServer("s1")).rejects.toThrow("ENOENT");

    expect(tools.save).not.toHaveBeenCalled();
    expect(tools.delete).not.toHaveBeenCalled();
    expect(servers.update).toHaveBeenCalledWith("s1", expect.objectContaining({ lastSyncedError: "spawn npx ENOENT" }));
  });
});
