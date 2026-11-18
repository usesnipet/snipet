import { oauth2ManifestAuthSchema } from "@snipet/shared";

import { authStatusOf, hasOAuth2Client, resolveOAuth2Client } from "./oauth2.js";
import { resolveOptions } from "./options.js";

import type { BaseDriver } from "./driver.js";

const auth = oauth2ManifestAuthSchema.parse({
  type: "oauth2",
  authorizationUrl: "https://accounts.example.com/auth",
  tokenUrl: "https://accounts.example.com/token",
  clientId: "{{ env.OAUTH_EXAMPLE_ID }}",
  clientSecret: "{{ env.DATABASE_URL }}",
});

describe("resolveOAuth2Client", () => {
  it("reads OAUTH_ env vars and never the others", () => {
    const env = { OAUTH_EXAMPLE_ID: "id-1", DATABASE_URL: "postgres://secret" };
    expect(resolveOAuth2Client(auth, {}, env)).toEqual({ clientId: "id-1", clientSecret: undefined });
  });

  it("reads connection fields, for users bringing their own OAuth app", () => {
    const own = { ...auth, clientId: "{{ connection.clientId }}", clientSecret: "{{ connection.clientSecret }}" };
    expect(resolveOAuth2Client(own, { clientId: "mine", clientSecret: "s" }, {})).toEqual({
      clientId: "mine",
      clientSecret: "s",
    });
  });

  it("renders an unset env var as an empty clientId", () => {
    expect(resolveOAuth2Client(auth, {}, {}).clientId).toBe("");
  });
});

describe("resolveOptions", () => {
  const driver = { validateOptions: (options: unknown) => options } as BaseDriver<unknown>;
  const ref = { driver: "mcp", options: { headers: { Authorization: "Bearer {{ auth.accessToken }}" } } };

  it("fills {{auth.accessToken}} from the connection's token", () => {
    expect(resolveOptions(driver, ref, {}, { accessToken: "t1" })).toEqual({ headers: { Authorization: "Bearer t1" } });
  });

  it("renders it empty when the connection has no token yet", () => {
    expect(resolveOptions(driver, ref, {})).toEqual({ headers: { Authorization: "Bearer " } });
  });
});

describe("authStatusOf", () => {
  const now = 1_000_000;
  const token = { accessToken: "a", tokenType: "Bearer" };

  it("is none without oauth, missing before the first authorization", () => {
    expect(authStatusOf({ type: "none" }, token, now)).toBe("none");
    expect(authStatusOf(undefined, token, now)).toBe("none");
    expect(authStatusOf(auth, null, now)).toBe("missing");
  });

  it("stays connected past expiry while a refresh token can renew it", () => {
    expect(authStatusOf(auth, { ...token, expiresAt: now + 1 }, now)).toBe("connected");
    expect(authStatusOf(auth, { ...token, expiresAt: now, refreshToken: "r" }, now)).toBe("connected");
  });

  it("is expired once the token is gone or can't be renewed", () => {
    expect(authStatusOf(auth, { refreshToken: "r", tokenType: "Bearer" }, now)).toBe("expired");
    expect(authStatusOf(auth, { ...token, expiresAt: now }, now)).toBe("expired");
  });
});

describe("hasOAuth2Client", () => {
  it("needs the env var set, unless each connection brings its own client", () => {
    expect(hasOAuth2Client(auth, { OAUTH_EXAMPLE_ID: "id-1" })).toBe(true);
    expect(hasOAuth2Client(auth, {})).toBe(false);
    expect(hasOAuth2Client({ ...auth, clientId: "{{ connection.clientId }}" }, {})).toBe(true);
  });
});
