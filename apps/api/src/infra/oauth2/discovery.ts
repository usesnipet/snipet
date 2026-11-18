import { safeFetch } from "#src/infra/http/safe-fetch.js";
import { z } from "zod";

import { OAuth2Error, TIMEOUT_MS } from "./oauth2.js";

import type { OAuth2Client, OAuth2Provider } from "./oauth2.js";

/** A provider found from its resource's metadata, with what registering a client there needs. */
export interface DiscoveredProvider extends OAuth2Provider {
  /** RFC 7591; without it, clients can't be registered. */
  registrationUrl?: string;
  /** How the token endpoint accepts client credentials (RFC 8414 `token_endpoint_auth_methods_supported`). */
  tokenAuthMethods?: string[];
}

/** A client registered through Dynamic Client Registration. Holds a secret: never log it. */
export interface RegisteredClient extends OAuth2Client {
  /** Epoch milliseconds the secret stops working; absent when it never does. */
  expiresAt?: number;
}

/** RFC 9728 §2, the fields read. */
const resourceMetadataSchema = z.object({
  resource: z.url(),
  authorization_servers: z.array(z.url()).min(1),
  scopes_supported: z.array(z.string()).optional(),
});

/** RFC 8414 §2, the fields read. */
const serverMetadataSchema = z.object({
  issuer: z.url(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  registration_endpoint: z.url().optional(),
  revocation_endpoint: z.url().optional(),
  code_challenge_methods_supported: z.array(z.string()).optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
});

/** RFC 7591 §3.2.1, the fields read. */
const registrationResponseSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(),
  /** Seconds since the epoch; 0 means it never expires. */
  client_secret_expires_at: z.number().optional(),
});

/**
 * Finds the authorization server of a protected resource (an MCP server, as
 * in the MCP authorization spec): the resource's metadata (RFC 9728) names
 * the server, whose metadata (RFC 8414 or OpenID discovery) gives the
 * endpoints. `scopes` overrides the ones the resource asks for.
 */
export async function discoverProvider(resourceUrl: string, scopes?: readonly string[]): Promise<DiscoveredProvider> {
  const { metadata, scope } = await findResourceMetadata(resourceUrl);
  // A resource without metadata predates RFC 9728 in MCP: its origin is the authorization server.
  const issuer = metadata?.authorization_servers[0] ?? new URL(resourceUrl).origin;
  const server = await findServerMetadata(issuer);
  // PKCE is required, and a server that doesn't list S256 may not check it.
  if (!server.code_challenge_methods_supported?.includes("S256")) throw new OAuth2Error("pkce_not_supported");
  return {
    authorizationUrl: server.authorization_endpoint,
    tokenUrl: server.token_endpoint,
    revokeUrl: server.revocation_endpoint,
    registrationUrl: server.registration_endpoint,
    tokenAuthMethods: server.token_endpoint_auth_methods_supported,
    scopes: scopes ?? scope?.split(" ") ?? metadata?.scopes_supported ?? [],
    pkce: true,
    extraParams: {},
    resource: metadata?.resource ?? resourceUrl,
  };
}

/** Registers a client at the provider (RFC 7591), redirecting to `redirectUri`. */
export async function registerClient(
  provider: DiscoveredProvider,
  params: { redirectUri: string; clientName: string },
): Promise<RegisteredClient> {
  if (!provider.registrationUrl) throw new OAuth2Error("registration_not_supported");
  // ponytail: public client when the server allows it, else client_secret_post; add client_secret_basic when a server only takes that.
  const authMethod = provider.tokenAuthMethods?.includes("none") ? "none" : "client_secret_post";
  const response = await safeFetch(provider.registrationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: params.clientName,
      redirect_uris: [params.redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: authMethod,
      ...(provider.scopes.length ? { scope: provider.scopes.join(" ") } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined;
  if (!response.ok) {
    throw new OAuth2Error(typeof body?.error === "string" ? body.error : `http_${response.status}`);
  }
  const parsed = registrationResponseSchema.safeParse(body);
  if (!parsed.success) throw new OAuth2Error("invalid_registration_response");
  const { client_id, client_secret, client_secret_expires_at } = parsed.data;
  return {
    clientId: client_id,
    clientSecret: client_secret,
    expiresAt: client_secret && client_secret_expires_at ? client_secret_expires_at * 1000 : undefined,
  };
}

/** Whether the client's secret has expired, so it must be registered again. */
export function isClientExpired(client: RegisteredClient, now = Date.now()): boolean {
  return client.expiresAt !== undefined && client.expiresAt <= now;
}

/**
 * The resource's metadata: from the `resource_metadata` its 401 points to,
 * else from the well-known URIs (with the resource's path, then without).
 * `scope` is the one its 401 asks for. Metadata on another origin than the
 * resource is ignored, so a server can't have tokens issued for another one.
 */
async function findResourceMetadata(
  resourceUrl: string,
): Promise<{ metadata?: z.infer<typeof resourceMetadataSchema>; scope?: string }> {
  const challenge = await probe(resourceUrl);
  const { origin, pathname } = new URL(resourceUrl);
  const path = pathname === "/" ? "" : pathname.replace(/\/$/, "");
  const candidates = [
    challenge.metadataUrl,
    path && `${origin}/.well-known/oauth-protected-resource${path}`,
    `${origin}/.well-known/oauth-protected-resource`,
  ].filter((url): url is string => !!url);
  for (const url of candidates) {
    const metadata = await getJson(url, resourceMetadataSchema);
    if (metadata && new URL(metadata.resource).origin === origin) return { metadata, scope: challenge.scope };
  }
  return { scope: challenge.scope };
}

/**
 * The authorization server's metadata, at the well-known URIs the MCP spec
 * lists for an issuer with or without a path. Its `issuer` must be the one
 * asked for (RFC 8414 §3.3).
 */
async function findServerMetadata(issuer: string): Promise<z.infer<typeof serverMetadataSchema>> {
  const { origin, pathname } = new URL(issuer);
  const path = pathname === "/" ? "" : pathname.replace(/\/$/, "");
  const candidates = path
    ? [
        `${origin}/.well-known/oauth-authorization-server${path}`,
        `${origin}/.well-known/openid-configuration${path}`,
        `${origin}${path}/.well-known/openid-configuration`,
      ]
    : [`${origin}/.well-known/oauth-authorization-server`, `${origin}/.well-known/openid-configuration`];
  for (const url of candidates) {
    const metadata = await getJson(url, serverMetadataSchema);
    if (metadata && metadata.issuer.replace(/\/$/, "") === `${origin}${path}`) return metadata;
  }
  throw new OAuth2Error("metadata_not_found");
}

/** What an unauthenticated request to the resource says in its `WWW-Authenticate` (RFC 9728 §5.1). */
async function probe(resourceUrl: string): Promise<{ metadataUrl?: string; scope?: string }> {
  try {
    const response = await safeFetch(resourceUrl, {
      headers: { Accept: "application/json, text/event-stream" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Only the headers matter: a server that streams without auth would otherwise keep this open.
    await response.body?.cancel();
    const header = response.status === 401 ? (response.headers.get("www-authenticate") ?? "") : "";
    return {
      metadataUrl: /resource_metadata="([^"]+)"/.exec(header)?.[1],
      scope: /scope="([^"]+)"/.exec(header)?.[1],
    };
  } catch {
    return {};
  }
}

/** GETs JSON matching `schema`; undefined when the URL fails, answers non-2xx or doesn't match. */
async function getJson<S extends z.ZodType>(url: string, schema: S): Promise<z.infer<S> | undefined> {
  try {
    const response = await safeFetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
