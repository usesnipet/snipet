import { AppContext } from "#src/common/context/app-context.js";
import { jest } from "@jest/globals";
import { pluginManifestSchema } from "@snipet/shared/core";

import { PluginConnectionService } from "./plugin-connection.service.js";

import type { PluginConnection } from "./plugin-connection.entity.js";
import type { PluginConnectionTokenService } from "./plugin-connection.token.service.js";
import type { PluginConnectionSyncService } from "./sync/plugin-connection-sync.service.js";
import type { PluginDriverRegistry, PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";
import type { EntityManager } from "typeorm";

const manifest = pluginManifestSchema.parse({
  key: "google",
  name: "Google",
  auth: {
    type: "oauth2",
    authorizationUrl: "https://accounts.example.com/auth",
    tokenUrl: "https://accounts.example.com/token",
    clientId: "{{ env.OAUTH_GOOGLE_ID }}",
  },
  connection: { type: "object", properties: { token: { type: "string", secret: true } } },
  capabilities: { tools: { driver: "mcp", options: { token: "Bearer {{ auth.accessToken }}" } } },
});

const remote = pluginManifestSchema.parse({
  key: "remote",
  name: "Remote MCP",
  auth: { type: "oauth2_discovery", resource: "{{ connection.url }}" },
  connection: { type: "object", properties: { url: { type: "string" }, team: { type: "string" } } },
  capabilities: { tools: { driver: "mcp", options: { token: "Bearer {{ auth.accessToken }}" } } },
});

const manifests = {
  getAll: () => [manifest, remote],
  find: (key: string) => ({ google: manifest, remote })[key],
  get: (key: string) => ({ google: manifest, remote })[key],
};

const service = new PluginConnectionService(
  {} as EntityManager,
  manifests as unknown as PluginManifestRegistry,
  {} as PluginDriverRegistry,
  {} as PluginConnectionSyncService,
  {} as PluginConnectionTokenService,
);

const ctx = AppContext.create("test");

describe("PluginConnectionService.mask", () => {
  it("never lets the OAuth tokens out, only the status", () => {
    const conn = {
      id: "c1",
      pluginKey: "google",
      config: { token: "cfg-secret" },
      credentials: { accessToken: "at-secret", refreshToken: "rt-secret", tokenType: "Bearer" },
    } as unknown as PluginConnection;

    const masked = service.mask(ctx, conn);
    const json = JSON.stringify(masked);

    expect(masked.authStatus).toBe("connected");
    expect(json).not.toContain("at-secret");
    expect(json).not.toContain("rt-secret");
    expect(json).not.toContain("cfg-secret");
    expect(json).not.toContain("credentials");
  });

  it("is missing before authorization and none when the plugin left the catalog", () => {
    const conn = { id: "c1", pluginKey: "google", config: {}, credentials: null } as unknown as PluginConnection;
    expect(service.mask(ctx, conn).authStatus).toBe("missing");
    expect(service.mask(ctx, { ...conn, pluginKey: "gone" }).authStatus).toBe("none");
  });
});

describe("PluginConnectionService.checkUpdate", () => {
  const existing = {
    id: "c1",
    pluginKey: "remote",
    config: { url: "https://mcp.example/mcp", team: "a" },
    credentials: { accessToken: "at", tokenType: "Bearer" },
  } as unknown as PluginConnection;
  const checkUpdate = (dto: object) => {
    jest.spyOn(service, "findById").mockResolvedValue(existing);
    jest.spyOn(service, "validateConfig").mockImplementation((_ctx, _key, config) => config ?? {});
    return (service as unknown as { checkUpdate: (...args: unknown[]) => Promise<object> }).checkUpdate(ctx, "c1", dto);
  };

  it("drops the tokens when the plugin or a discovered resource changes", async () => {
    await expect(checkUpdate({ config: { url: "https://evil.example/mcp" } })).resolves.toMatchObject({
      credentials: null,
    });
    await expect(checkUpdate({ pluginKey: "google" })).resolves.toMatchObject({ credentials: null });
  });

  it("keeps them when the resource stays the same", async () => {
    const checked = await checkUpdate({ config: { url: "https://mcp.example/mcp", team: "b" } });
    expect(checked).not.toHaveProperty("credentials");
  });
});
