import { AppContext } from "#src/common/context/app-context.js";
import { pluginManifestSchema } from "@snipet/shared/core";
import { createServer } from "node:http";

import {
  AUTHORIZATION_EXPIRED,
  NOT_AUTHORIZED,
  PluginConnectionTokenService,
} from "./plugin-connection.token.service.js";

import type { PluginConnectionCredentials } from "./plugin-connection.entity.js";
import type { PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { EntityManager } from "typeorm";

/** The fake provider: how many refreshes it served and what it answers next. */
const provider = { calls: 0, status: 200, body: {} as unknown, delayMs: 0 };
let server: Server;
let tokenUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      provider.calls++;
      setTimeout(
        () => res.writeHead(provider.status, { "Content-Type": "application/json" }).end(JSON.stringify(provider.body)),
        provider.delayMs,
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  tokenUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/token`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const ctx = AppContext.create("test");
const stale = (extra: Partial<PluginConnectionCredentials> = {}): PluginConnectionCredentials => ({
  accessToken: "old",
  refreshToken: "rt",
  expiresAt: Date.now() + 1000,
  tokenType: "Bearer",
  ...extra,
});

/**
 * A service on a one-row fake table. Transactions run one at a time, which
 * stands in for the row lock (`SELECT ... FOR UPDATE`).
 */
function setup(credentials: PluginConnectionCredentials | null, pluginKey = "google") {
  const manifest = pluginManifestSchema.parse({
    key: "google",
    name: "Google",
    auth: { type: "oauth2", authorizationUrl: "https://a.example/auth", tokenUrl, clientId: "cid" },
    capabilities: { tools: { driver: "mcp", options: { token: "Bearer {{ auth.accessToken }}" } } },
  });
  const remote = pluginManifestSchema.parse({
    key: "remote",
    name: "Remote MCP",
    auth: { type: "oauth2_discovery", resource: "https://mcp.example/mcp" },
    capabilities: { tools: { driver: "mcp", options: { token: "Bearer {{ auth.accessToken }}" } } },
  });
  const row = { id: "c1", pluginKey, config: {}, credentials, lastSyncedError: null as string | null };
  const repository = {
    createQueryBuilder: () => {
      const query = { setLock: () => query, where: () => query, getOne: () => Promise.resolve({ ...row }) };
      return query;
    },
    update: (_id: string, fields: Partial<typeof row>) => {
      // The sealing transformer JSON-encodes, which drops undefined fields.
      Object.assign(row, JSON.parse(JSON.stringify(fields)) as Partial<typeof row>);
      return Promise.resolve();
    },
  };
  let queue = Promise.resolve();
  const manager = {
    transaction: <R>(fn: (tx: unknown) => Promise<R>): Promise<R> => {
      const run = queue.then(() => fn({ getRepository: () => repository }));
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  const registry = { find: (key: string) => ({ google: manifest, remote })[key] };
  const service = new PluginConnectionTokenService(
    manager as unknown as EntityManager,
    registry as unknown as PluginManifestRegistry,
  );
  return { service, row };
}

describe("PluginConnectionTokenService.authOf", () => {
  beforeEach(() => {
    provider.calls = 0;
    provider.status = 200;
    provider.body = { access_token: "new", expires_in: 3600 };
    provider.delayMs = 0;
  });

  it("is undefined for a plugin without OAuth", async () => {
    const { service, row } = setup(null);
    await expect(service.authOf(ctx, { ...row, pluginKey: "plain" })).resolves.toBeUndefined();
  });

  it("hands out a fresh token without calling the provider", async () => {
    const { service, row } = setup(stale({ expiresAt: Date.now() + 3_600_000 }));
    await expect(service.authOf(ctx, row)).resolves.toEqual({ accessToken: "old" });
    expect(provider.calls).toBe(0);
  });

  it("refuses a connection never authorized or already expired", async () => {
    await expect(setup(null).service.authOf(ctx, setup(null).row)).rejects.toThrow(NOT_AUTHORIZED);
    const { service, row } = setup(stale({ accessToken: undefined }));
    await expect(service.authOf(ctx, row)).rejects.toThrow(AUTHORIZATION_EXPIRED);
  });

  it("renews a token about to expire and stores it", async () => {
    const { service, row } = setup(stale());
    await expect(service.authOf(ctx, row)).resolves.toEqual({ accessToken: "new" });
    expect(row.credentials).toMatchObject({ accessToken: "new", refreshToken: "rt" });
  });

  it("renews a discovered connection at its provider, with its registered client", async () => {
    const discovered = {
      resourceUrl: "https://mcp.example/mcp",
      provider: { authorizationUrl: "https://a", tokenUrl, scopes: [], pkce: true, extraParams: {} },
      client: { clientId: "registered" },
    };
    const { service, row } = setup(stale({ discovered }), "remote");
    await expect(service.authOf(ctx, row)).resolves.toEqual({ accessToken: "new" });
    expect(row.credentials).toMatchObject({ accessToken: "new", discovered });
  });

  it("refreshes once when two callers race", async () => {
    provider.delayMs = 50;
    const { service, row } = setup(stale());
    const snapshot = { ...row };
    const [first, second] = await Promise.all([service.authOf(ctx, snapshot), service.authOf(ctx, snapshot)]);
    expect(first).toEqual({ accessToken: "new" });
    expect(second).toEqual({ accessToken: "new" });
    expect(provider.calls).toBe(1);
  });

  it("marks the connection expired when the provider refuses the refresh", async () => {
    provider.status = 400;
    provider.body = { error: "invalid_grant" };
    const { service, row } = setup(stale());
    await expect(service.authOf(ctx, row)).rejects.toThrow(AUTHORIZATION_EXPIRED);
    expect(row.credentials).toEqual({
      refreshToken: "rt",
      expiresAt: expect.any(Number) as unknown,
      tokenType: "Bearer",
    });
    expect(row.lastSyncedError).toBe(AUTHORIZATION_EXPIRED);
  });

  it("keeps the token on a provider outage, to retry next time", async () => {
    provider.status = 503;
    provider.body = {};
    const { service, row } = setup(stale());
    await expect(service.authOf(ctx, row)).rejects.toThrow("http_503");
    expect(row.credentials).toMatchObject({ accessToken: "old" });
  });
});
