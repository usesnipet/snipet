import { AppContext } from "#src/common/context/app-context.js";
import { env } from "#src/env.js";
import { jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { seal } from "@snipet/server-common";
import { pluginManifestSchema } from "@snipet/shared/core";
import { createServer } from "node:http";

import { PluginConnectionOAuthService } from "./plugin-connection.oauth.service.js";

import type { PluginConnection } from "./plugin-connection.entity.js";
import type { PluginConnectionService } from "./plugin-connection.service.js";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

type Fn = (...args: unknown[]) => Promise<unknown>;

/** The fake provider's last token request and its next answer, and how many clients registered there. */
const provider = { form: new URLSearchParams(), status: 200, body: {} as unknown, registrations: 0 };
let server: Server;
let origin: string;
let tokenUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    req.on("end", () => {
      const reply = (status: number, body: unknown) =>
        res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
      // Discovery: an authorization server at the origin, with registration.
      if (req.url === "/.well-known/oauth-authorization-server") {
        return reply(200, {
          issuer: origin,
          authorization_endpoint: `${origin}/authorize`,
          token_endpoint: tokenUrl,
          registration_endpoint: `${origin}/register`,
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
        });
      }
      if (req.url === "/register") return reply(201, { client_id: `registered-${++provider.registrations}` });
      if (req.url !== "/token") return reply(404, {});
      provider.form = new URLSearchParams(raw);
      reply(provider.status, provider.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  tokenUrl = `${origin}/token`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const ctx = AppContext.create("test");

function setup(pluginKey = "google") {
  const manifest = pluginManifestSchema.parse({
    key: "google",
    name: "Google",
    auth: {
      type: "oauth2",
      authorizationUrl: "https://accounts.example.com/auth",
      tokenUrl,
      clientId: "{{ connection.clientId }}",
    },
    connection: { type: "object", properties: { clientId: { type: "string" } } },
    capabilities: { tools: { driver: "mcp", options: { token: "Bearer {{ auth.accessToken }}" } } },
  });
  const plain = pluginManifestSchema.parse({ key: "plain", name: "Plain", capabilities: { tools: { driver: "mcp" } } });
  const remote = pluginManifestSchema.parse({
    key: "remote",
    name: "Remote MCP",
    auth: { type: "oauth2_discovery", resource: "{{ connection.url }}" },
    connection: { type: "object", properties: { url: { type: "string" } } },
    capabilities: { tools: { driver: "mcp", options: { token: "Bearer {{ auth.accessToken }}" } } },
  });
  const manifests = { google: manifest, plain, remote };
  const config = { clientId: "cid", url: `${origin}/mcp` };
  const conn = { id: "c1", pluginKey, config, credentials: null } as unknown as PluginConnection;
  const pluginConnectionService = {
    findById: jest.fn<Fn>().mockResolvedValue(conn),
    getManifest: jest.fn((_ctx: unknown, key: string) => manifests[key as keyof typeof manifests]),
    listManifests: () => Object.values(manifests),
    saveCredentials: jest.fn<Fn>().mockResolvedValue(undefined),
    sync: jest.fn<Fn>().mockResolvedValue(undefined),
  };
  const service = new PluginConnectionOAuthService(pluginConnectionService as unknown as PluginConnectionService);
  return { service, pluginConnectionService, conn };
}

/** The state of a URL from `authorize`. */
const stateOf = (url: string) => new URL(url).searchParams.get("state")!;

/** The query of the URL the callback redirects to. */
const queryOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("PluginConnectionOAuthService", () => {
  beforeEach(() => {
    provider.status = 200;
    provider.body = { access_token: "at", refresh_token: "rt", expires_in: 3600 };
  });

  it("authorizes with PKCE and stores the tokens on callback", async () => {
    const { service, pluginConnectionService } = setup();
    const { url } = await service.authorize(ctx, "c1", "/plugins?tab=x");
    const authorizeQuery = queryOf(url);
    expect(authorizeQuery).toMatchObject({ client_id: "cid", code_challenge_method: "S256" });
    expect(authorizeQuery.redirect_uri).toBe(`${env.PUBLIC_URL}/api/oauth/callback`);

    const back = await service.callback(ctx, { code: "code-1", state: stateOf(url) });

    expect(back.startsWith(`${env.WEB_URL}/plugins?`)).toBe(true);
    expect(queryOf(back)).toEqual({ tab: "x", connectionId: "c1", oauth: "success" });
    expect(provider.form.get("code_verifier")).toBeTruthy();
    expect(pluginConnectionService.saveCredentials).toHaveBeenCalledWith(
      ctx,
      "c1",
      expect.objectContaining({ accessToken: "at", refreshToken: "rt" }),
    );
    expect(pluginConnectionService.sync).toHaveBeenCalledWith(ctx, "c1");
  });

  it("discovers the provider, registers a client once and keeps it with the tokens", async () => {
    const { service, pluginConnectionService, conn } = setup("remote");
    provider.registrations = 0;
    const { url } = await service.authorize(ctx, "c1", "/plugins");
    expect(queryOf(url)).toMatchObject({ client_id: "registered-1", resource: `${origin}/mcp` });

    const back = await service.callback(ctx, { code: "code-1", state: stateOf(url) });
    expect(queryOf(back)).toMatchObject({ oauth: "success" });
    expect(provider.form.get("client_id")).toBe("registered-1");
    expect(provider.form.get("resource")).toBe(`${origin}/mcp`);
    const [, , saved] = pluginConnectionService.saveCredentials.mock.calls[0] as [
      unknown,
      unknown,
      PluginConnection["credentials"],
    ];
    expect(saved).toMatchObject({
      accessToken: "at",
      discovered: { resourceUrl: `${origin}/mcp`, client: { clientId: "registered-1" } },
    });

    // Authorizing again reuses the client while the resource is the same.
    conn.credentials = saved;
    expect(queryOf((await service.authorize(ctx, "c1", "/")).url).client_id).toBe("registered-1");
    expect(provider.registrations).toBe(1);
  });

  it("refuses a plugin without OAuth or without a client", async () => {
    await expect(setup("plain").service.authorize(ctx, "c1", "/")).rejects.toThrow(BadRequestException);
    const { service, conn } = setup();
    conn.config = {};
    await expect(service.authorize(ctx, "c1", "/")).rejects.toThrow("is not configured");
  });

  it("sends a missing, tampered or expired state to the web root", async () => {
    const { service, pluginConnectionService } = setup();
    const { url } = await service.authorize(ctx, "c1", "/plugins");
    const expired = seal(
      JSON.stringify({ data: { connectionId: "c1", returnTo: "/plugins" }, expiresAt: Date.now() - 1 }),
      env.ENCRYPTION_KEY,
    );

    const state = stateOf(url);
    // A char in the middle: one appended to base64url may decode to the same bytes.
    const tampered = `${state.slice(0, 20)}${state[20] === "A" ? "B" : "A"}${state.slice(21)}`;
    for (const state of [undefined, tampered, expired]) {
      const back = await service.callback(ctx, { code: "code-1", state });
      expect(back).toBe(`${env.WEB_URL}/?oauth=error&reason=invalid_state`);
    }
    expect(pluginConnectionService.saveCredentials).not.toHaveBeenCalled();
  });

  it("reports the provider's refusal without storing anything", async () => {
    const { service, pluginConnectionService } = setup();
    const { url } = await service.authorize(ctx, "c1", "/plugins");

    const denied = await service.callback(ctx, { error: "access_denied", state: stateOf(url) });
    expect(queryOf(denied)).toMatchObject({ oauth: "error", reason: "access_denied" });

    provider.status = 400;
    provider.body = { error: "invalid_grant" };
    const rejected = await service.callback(ctx, { code: "used", state: stateOf(url) });
    expect(queryOf(rejected)).toMatchObject({ oauth: "error", reason: "invalid_grant" });

    const odd = await service.callback(ctx, { error: "<script>", state: stateOf(url) });
    expect(queryOf(odd)).toMatchObject({ reason: "failed" });
    expect(pluginConnectionService.saveCredentials).not.toHaveBeenCalled();
  });

  it("never redirects to another origin", async () => {
    const { service } = setup();
    const { url } = await service.authorize(ctx, "c1", "/\t/evil.example");
    const back = await service.callback(ctx, { code: "code-1", state: stateOf(url) });
    expect(new URL(back).origin).toBe(new URL(env.WEB_URL).origin);
  });

  it("forgets the tokens on disconnect", async () => {
    const { service, pluginConnectionService, conn } = setup();
    conn.credentials = { accessToken: "at", refreshToken: "rt", tokenType: "Bearer" };
    await service.disconnect(ctx, "c1");
    expect(pluginConnectionService.saveCredentials).toHaveBeenCalledWith(ctx, "c1", null);
  });
});
