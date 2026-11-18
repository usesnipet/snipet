import { createServer } from "node:http";

import { discoverProvider, isClientExpired, registerClient } from "./discovery.js";
import { OAuth2Error } from "./oauth2.js";

import type { AddressInfo } from "node:net";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

/** Routes of the fake MCP and authorization server, by path; the last registration body it got. */
const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => void>();
let registration: unknown;
let server: Server;
let origin: string;

const json =
  (body: unknown, status = 200) =>
  (_req: IncomingMessage, res: ServerResponse) =>
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    req.on("end", () => {
      if (req.method === "POST" && req.url === "/register") registration = JSON.parse(raw);
      const route = routes.get(req.url ?? "");
      if (route) route(req, res);
      else res.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

/** An authorization server at `issuer` with S256 and registration. */
const serverMetadata = (issuer: string, extra: Record<string, unknown> = {}) => ({
  issuer,
  authorization_endpoint: `${issuer}/authorize`,
  token_endpoint: `${issuer}/token`,
  registration_endpoint: `${origin}/register`,
  revocation_endpoint: `${issuer}/revoke`,
  code_challenge_methods_supported: ["S256"],
  ...extra,
});

beforeEach(() => {
  routes.clear();
  registration = undefined;
});

describe("discoverProvider", () => {
  it("follows the 401's resource_metadata to the authorization server", async () => {
    routes.set("/mcp", (_req, res) =>
      res.writeHead(401, { "WWW-Authenticate": `Bearer resource_metadata="${origin}/meta", scope="read write"` }).end(),
    );
    routes.set("/meta", json({ resource: `${origin}/mcp`, authorization_servers: [`${origin}/tenant`] }));
    routes.set("/.well-known/oauth-authorization-server/tenant", json(serverMetadata(`${origin}/tenant`)));

    await expect(discoverProvider(`${origin}/mcp`)).resolves.toEqual({
      authorizationUrl: `${origin}/tenant/authorize`,
      tokenUrl: `${origin}/tenant/token`,
      revokeUrl: `${origin}/tenant/revoke`,
      registrationUrl: `${origin}/register`,
      tokenAuthMethods: undefined,
      scopes: ["read", "write"],
      pkce: true,
      extraParams: {},
      resource: `${origin}/mcp`,
    });
  });

  it("falls back to the well-known URIs, and to the resource's origin without metadata", async () => {
    routes.set("/.well-known/openid-configuration", json(serverMetadata(origin)));
    const provider = await discoverProvider(`${origin}/mcp`, ["mine"]);
    expect(provider).toMatchObject({ tokenUrl: `${origin}/token`, scopes: ["mine"], resource: `${origin}/mcp` });

    routes.set(
      "/.well-known/oauth-protected-resource/mcp",
      json({ resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: ["s"] }),
    );
    await expect(discoverProvider(`${origin}/mcp`)).resolves.toMatchObject({ scopes: ["s"] });
  });

  it("refuses a server without S256, metadata for another issuer, or none at all", async () => {
    routes.set(
      "/.well-known/oauth-authorization-server",
      json(serverMetadata(origin, { code_challenge_methods_supported: ["plain"] })),
    );
    await expect(discoverProvider(`${origin}/mcp`)).rejects.toMatchObject({ code: "pkce_not_supported" });

    routes.set("/.well-known/oauth-authorization-server", json(serverMetadata("https://evil.example")));
    await expect(discoverProvider(`${origin}/mcp`)).rejects.toMatchObject({ code: "metadata_not_found" });

    routes.clear();
    await expect(discoverProvider(`${origin}/mcp`)).rejects.toThrow(OAuth2Error);
  });
});

describe("registerClient", () => {
  const params = { redirectUri: "https://app/cb", clientName: "Snipet" };
  /** A discovered provider registering at the fake server. */
  const providerOf = (extra: Record<string, unknown> = {}) => ({
    authorizationUrl: "https://as/authorize",
    tokenUrl: "https://as/token",
    scopes: ["read"],
    pkce: true,
    extraParams: {},
    registrationUrl: `${origin}/register`,
    ...extra,
  });

  it("registers a public client when the server allows it", async () => {
    routes.set("/register", json({ client_id: "cid" }, 201));
    const client = await registerClient(providerOf({ tokenAuthMethods: ["none"] }), params);
    expect(client).toEqual({ clientId: "cid", clientSecret: undefined, expiresAt: undefined });
    expect(registration).toMatchObject({
      redirect_uris: ["https://app/cb"],
      token_endpoint_auth_method: "none",
      scope: "read",
    });
  });

  it("keeps the secret and when it expires", async () => {
    routes.set("/register", json({ client_id: "cid", client_secret: "s", client_secret_expires_at: 10 }, 201));
    const client = await registerClient(providerOf(), params);
    expect(client).toEqual({ clientId: "cid", clientSecret: "s", expiresAt: 10_000 });
    expect(registration).toMatchObject({ token_endpoint_auth_method: "client_secret_post" });
    expect(isClientExpired(client, 10_000)).toBe(true);
    expect(isClientExpired({ clientId: "c" })).toBe(false);
  });

  it("throws the server's error, or registration_not_supported without an endpoint", async () => {
    routes.set("/register", json({ error: "invalid_redirect_uri" }, 400));
    await expect(registerClient(providerOf(), params)).rejects.toMatchObject({ code: "invalid_redirect_uri" });
    await expect(registerClient(providerOf({ registrationUrl: undefined }), params)).rejects.toMatchObject({
      code: "registration_not_supported",
    });
  });
});
