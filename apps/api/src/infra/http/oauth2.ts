import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { safeFetch } from "./safe-fetch.js";

import type { OAuth2Client, OAuth2Credentials } from "#src/core/manifest/oauth2.js";
import type { OAuth2ManifestAuth } from "@snipet/shared";

/** How long a token call may take before it's given up. */
const TIMEOUT_MS = 10_000;

/**
 * A provider's refusal. `code` is the OAuth `error` (e.g. `invalid_grant`), or
 * `http_<status>` when the body didn't say; the body itself is never kept, it
 * may echo secrets.
 */
export class OAuth2Error extends Error {
  constructor(readonly code: string) {
    super(`OAuth provider answered ${code}`);
  }
}

/** RFC 6749 §5.1. Only `access_token` is required by every provider. */
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default("Bearer"),
  expires_in: z.coerce.number().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});

/** A PKCE pair (RFC 7636, S256): the verifier stays with us, the challenge goes to the provider. */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

/** The provider's consent page URL. `codeChallenge` only when the manifest uses PKCE. */
export function buildAuthorizeUrl(
  auth: OAuth2ManifestAuth,
  client: OAuth2Client,
  params: { state: string; redirectUri: string; codeChallenge?: string },
): string {
  const url = new URL(auth.authorizationUrl);
  const query = url.searchParams;
  for (const [name, value] of Object.entries(auth.extraParams)) query.set(name, value);
  query.set("response_type", "code");
  query.set("client_id", client.clientId);
  query.set("redirect_uri", params.redirectUri);
  query.set("state", params.state);
  if (auth.scopes.length) query.set("scope", auth.scopes.join(" "));
  if (params.codeChallenge) {
    query.set("code_challenge", params.codeChallenge);
    query.set("code_challenge_method", "S256");
  }
  return url.toString();
}

/** Trades the authorization code for tokens. */
export function exchangeCode(
  auth: OAuth2ManifestAuth,
  client: OAuth2Client,
  params: { code: string; redirectUri: string; codeVerifier?: string },
  now = Date.now(),
): Promise<OAuth2Credentials> {
  return requestToken(
    auth,
    client,
    {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
    },
    now,
  );
}

/**
 * Renews the access token. A provider that doesn't rotate the refresh token
 * (Google) sends none back, so the current one is kept.
 */
export async function refreshCredentials(
  auth: OAuth2ManifestAuth,
  client: OAuth2Client,
  credentials: OAuth2Credentials,
  now = Date.now(),
): Promise<OAuth2Credentials> {
  if (!credentials.refreshToken) throw new OAuth2Error("invalid_grant");
  const renewed = await requestToken(
    auth,
    client,
    { grant_type: "refresh_token", refresh_token: credentials.refreshToken },
    now,
  );
  return { ...renewed, refreshToken: renewed.refreshToken ?? credentials.refreshToken };
}

/** Revokes a token at the provider (RFC 7009); a no-op when the manifest has no `revokeUrl`. */
export async function revokeToken(auth: OAuth2ManifestAuth, client: OAuth2Client, token: string): Promise<void> {
  if (!auth.revokeUrl) return;
  const response = await post(auth.revokeUrl, { token, ...clientParams(client) });
  if (!response.ok) throw new OAuth2Error(`http_${response.status}`);
}

/** POSTs a token request and turns the answer into credentials. */
async function requestToken(
  auth: OAuth2ManifestAuth,
  client: OAuth2Client,
  params: Record<string, string>,
  now: number,
): Promise<OAuth2Credentials> {
  const response = await post(auth.tokenUrl, { ...params, ...clientParams(client) });
  const body = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined;
  if (!response.ok) {
    throw new OAuth2Error(typeof body?.error === "string" ? body.error : `http_${response.status}`);
  }
  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success) throw new OAuth2Error("invalid_token_response");
  const token = parsed.data;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in ? now + token.expires_in * 1000 : undefined,
    scope: token.scope,
    tokenType: token.token_type,
  };
}

/** The client's credentials as body params (client_secret_post). */
// ponytail: client_secret_post only; add HTTP Basic (client_secret_basic) when a provider refuses the body form.
function clientParams(client: OAuth2Client): Record<string, string> {
  return { client_id: client.clientId, ...(client.clientSecret ? { client_secret: client.clientSecret } : {}) };
}

/** A form-encoded POST through `safeFetch`, with a timeout. */
function post(url: string, params: Record<string, string>): Promise<Response> {
  return safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
