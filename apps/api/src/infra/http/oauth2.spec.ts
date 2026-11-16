import { oauth2ManifestAuthSchema } from "@snipet/shared";
import { createHash } from "node:crypto";
import { createServer } from "node:http";

import { buildAuthorizeUrl, createPkce, exchangeCode, OAuth2Error, refreshCredentials } from "./oauth2.js";

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/** What the fake provider got on its last token request, and what it answers next. */
const provider = { form: new URLSearchParams(), status: 200, body: {} as unknown };

let server: Server;
let tokenUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    req.on("end", () => {
      provider.form = new URLSearchParams(raw);
      res.writeHead(provider.status, { "Content-Type": "application/json" }).end(JSON.stringify(provider.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  tokenUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/token`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const authOf = () =>
  oauth2ManifestAuthSchema.parse({
    type: "oauth2",
    authorizationUrl: "https://accounts.example.com/auth?hd=example.com",
    tokenUrl,
    scopes: ["a", "b"],
    clientId: "x",
    extraParams: { access_type: "offline" },
  });
const client = { clientId: "cid", clientSecret: "csecret" };

describe("createPkce", () => {
  it("pairs the verifier with its S256 challenge", () => {
    const { verifier, challenge } = createPkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });
});

describe("buildAuthorizeUrl", () => {
  it("keeps the URL's own params and adds the flow's", () => {
    const url = new URL(
      buildAuthorizeUrl(authOf(), client, { state: "s", redirectUri: "https://r", codeChallenge: "c" }),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      hd: "example.com",
      access_type: "offline",
      response_type: "code",
      client_id: "cid",
      redirect_uri: "https://r",
      state: "s",
      scope: "a b",
      code_challenge: "c",
      code_challenge_method: "S256",
    });
  });
});

describe("exchangeCode", () => {
  it("sends the code, verifier and client, and maps the tokens", async () => {
    provider.status = 200;
    provider.body = { access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "a", token_type: "Bearer" };
    const credentials = await exchangeCode(
      authOf(),
      client,
      { code: "c1", redirectUri: "https://r", codeVerifier: "v" },
      0,
    );
    expect(Object.fromEntries(provider.form)).toEqual({
      grant_type: "authorization_code",
      code: "c1",
      redirect_uri: "https://r",
      code_verifier: "v",
      client_id: "cid",
      client_secret: "csecret",
    });
    expect(credentials).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 3_600_000,
      scope: "a",
      tokenType: "Bearer",
    });
  });

  it("throws the provider's error code, never its body", async () => {
    provider.status = 400;
    provider.body = { error: "invalid_grant", error_description: "secret-ish details" };
    const failure = exchangeCode(authOf(), client, { code: "c1", redirectUri: "https://r" });
    await expect(failure).rejects.toThrow(OAuth2Error);
    await expect(exchangeCode(authOf(), client, { code: "c1", redirectUri: "https://r" })).rejects.toMatchObject({
      code: "invalid_grant",
      message: expect.not.stringContaining("secret-ish") as unknown,
    });
  });
});

describe("refreshCredentials", () => {
  it("keeps the refresh token when the provider doesn't rotate it", async () => {
    provider.status = 200;
    provider.body = { access_token: "at2" };
    const renewed = await refreshCredentials(authOf(), client, {
      accessToken: "at",
      refreshToken: "rt",
      tokenType: "Bearer",
    });
    expect(provider.form.get("grant_type")).toBe("refresh_token");
    expect(provider.form.get("refresh_token")).toBe("rt");
    expect(renewed).toMatchObject({ accessToken: "at2", refreshToken: "rt" });
  });

  it("is invalid_grant without a refresh token", async () => {
    await expect(
      refreshCredentials(authOf(), client, { accessToken: "at", tokenType: "Bearer" }),
    ).rejects.toMatchObject({
      code: "invalid_grant",
    });
  });
});
