import { safeFetch } from "#src/infra/http/safe-fetch.js";
import { open, seal } from "@snipet/server-common";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/** How long a call to the provider may take before it's given up. */
export const TIMEOUT_MS = 10_000;

/** How long the user has to go through the provider's consent page. */
const STATE_TTL_MS = 10 * 60_000; // 10 minutes

/**
 * An authorization server's endpoints and what to ask it for. Nothing here is
 * provider-specific or knows who the tokens are for: callers keep their own
 * context in the `state` and decide where the tokens go.
 */
export interface OAuth2Provider {
  authorizationUrl: string;
  tokenUrl: string;
  /** RFC 7009; without it, revoking is a no-op. */
  revokeUrl?: string;
  scopes: readonly string[];
  /** Sends a PKCE challenge on authorize and its verifier on the code exchange. */
  pkce: boolean;
  /** Added to the authorize URL as is, e.g. Google's `access_type=offline`. */
  extraParams: Record<string, string>;
  /** RFC 8707: the resource the tokens are for, sent on authorize and on every token request. */
  resource?: string;
}

/** An app registered at the provider. Holds a secret: never log it. */
export interface OAuth2Client {
  clientId: string;
  clientSecret?: string;
}

/** What a token request gives back. Secret. */
export interface OAuth2Tokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds; absent when the provider didn't say. */
  expiresAt?: number;
  /** The scopes the user actually granted, which may differ from the ones asked. */
  scope?: string;
  tokenType: string;
}

/** Query of the provider's redirect to the callback (RFC 6749 §4.1.2). */
export interface OAuth2CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

/** What the callback carries: the caller's `data`, and either the code to exchange or the provider's `error`. */
export type OAuth2Callback<T> =
  { data: T; code: string; codeVerifier?: string; error?: undefined } | { data: T; error: string };

/**
 * What the `state` param carries through the provider. Sealed, so it can be
 * neither forged nor read (it holds the PKCE verifier), and nothing has to be
 * stored between authorize and callback.
 */
interface SealedState<T> {
  data: T;
  codeVerifier?: string;
  expiresAt: number;
}

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

/**
 * The provider's consent page, with `data` sealed into its `state` under
 * `key`; `openCallback` gets it back. `data` must be JSON.
 */
export function startAuthorization<T>(
  provider: OAuth2Provider,
  client: OAuth2Client,
  params: { redirectUri: string; data: T; key: Buffer },
  now = Date.now(),
): string {
  const pkce = provider.pkce ? createPkce() : undefined;
  const state: SealedState<T> = { data: params.data, codeVerifier: pkce?.verifier, expiresAt: now + STATE_TTL_MS };
  return buildAuthorizeUrl(provider, client, {
    state: seal(JSON.stringify(state), params.key),
    redirectUri: params.redirectUri,
    codeChallenge: pkce?.challenge,
  });
}

/**
 * Reads the provider's redirect: undefined when the state is missing,
 * tampered with or expired, so there is no `data` to trust.
 */
// ponytail: a state can be replayed until it expires; harmless while providers keep codes single-use.
export function openCallback<T>(
  query: OAuth2CallbackQuery,
  key: Buffer,
  now = Date.now(),
): OAuth2Callback<T> | undefined {
  if (!query.state) return undefined;
  let state: SealedState<T>;
  try {
    state = JSON.parse(open(query.state, key)) as SealedState<T>;
  } catch {
    return undefined;
  }
  if (state.expiresAt <= now) return undefined;
  if (query.error || !query.code) return { data: state.data, error: query.error ?? "missing_code" };
  return { data: state.data, code: query.code, codeVerifier: state.codeVerifier };
}

/** The provider's consent page URL. `codeChallenge` only when the provider uses PKCE. */
export function buildAuthorizeUrl(
  provider: OAuth2Provider,
  client: OAuth2Client,
  params: { state: string; redirectUri: string; codeChallenge?: string },
): string {
  const url = new URL(provider.authorizationUrl);
  const query = url.searchParams;
  for (const [name, value] of Object.entries(provider.extraParams)) query.set(name, value);
  query.set("response_type", "code");
  query.set("client_id", client.clientId);
  query.set("redirect_uri", params.redirectUri);
  query.set("state", params.state);
  if (provider.scopes.length) query.set("scope", provider.scopes.join(" "));
  if (provider.resource) query.set("resource", provider.resource);
  if (params.codeChallenge) {
    query.set("code_challenge", params.codeChallenge);
    query.set("code_challenge_method", "S256");
  }
  return url.toString();
}

/** Trades the authorization code for tokens. */
export function exchangeCode(
  provider: OAuth2Provider,
  client: OAuth2Client,
  params: { code: string; redirectUri: string; codeVerifier?: string },
  now = Date.now(),
): Promise<OAuth2Tokens> {
  return requestToken(
    provider,
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
  provider: OAuth2Provider,
  client: OAuth2Client,
  credentials: { refreshToken?: string },
  now = Date.now(),
): Promise<OAuth2Tokens> {
  if (!credentials.refreshToken) throw new OAuth2Error("invalid_grant");
  const renewed = await requestToken(
    provider,
    client,
    { grant_type: "refresh_token", refresh_token: credentials.refreshToken },
    now,
  );
  return { ...renewed, refreshToken: renewed.refreshToken ?? credentials.refreshToken };
}

/** Revokes a token at the provider (RFC 7009); a no-op when it has no `revokeUrl`. */
export async function revokeToken(provider: OAuth2Provider, client: OAuth2Client, token: string): Promise<void> {
  if (!provider.revokeUrl) return;
  const response = await post(provider.revokeUrl, { token, ...clientParams(client) });
  if (!response.ok) throw new OAuth2Error(`http_${response.status}`);
}

/** POSTs a token request and turns the answer into credentials. */
async function requestToken(
  provider: OAuth2Provider,
  client: OAuth2Client,
  params: Record<string, string>,
  now: number,
): Promise<OAuth2Tokens> {
  const resource: Record<string, string> = provider.resource ? { resource: provider.resource } : {};
  const response = await post(provider.tokenUrl, { ...params, ...resource, ...clientParams(client) });
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
