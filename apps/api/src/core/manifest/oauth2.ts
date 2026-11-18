import { render } from "./template.js";

import type {
  JsonObject,
  ManifestAuth,
  OAuth2DiscoveryManifestAuth,
  OAuth2ManifestAuth,
  PluginAuthStatus,
} from "@snipet/shared";

/** Only env vars with this prefix reach `{{env.X}}`, so a manifest can't read the database URL or the sealing key. */
const ENV_PREFIX = "OAUTH_";

/** The tokens a connection got from its OAuth provider. Secret: stored sealed and never sent out by the API. */
export interface OAuth2Credentials {
  /** Dropped when a refresh is rejected, which leaves the connection `expired`. */
  accessToken?: string;
  refreshToken?: string;
  /** Epoch milliseconds; absent when the provider didn't say. */
  expiresAt?: number;
  /** The scopes the user actually granted, which may differ from the ones asked. */
  scope?: string;
  tokenType: string;
}

/** The OAuth client of a connection, its placeholders filled. Holds a secret: never log it. */
export interface OAuth2Client {
  clientId: string;
  clientSecret?: string;
}

/**
 * Fills `clientId` and `clientSecret` from the connection config and the
 * `OAUTH_*` env vars. A missing value renders empty, so an unset env var
 * shows up as an empty `clientId`.
 */
export function resolveOAuth2Client(
  auth: OAuth2ManifestAuth,
  connection: JsonObject,
  env: Record<string, string | undefined>,
): OAuth2Client {
  const oauthEnv = Object.fromEntries(Object.entries(env).filter(([name]) => name.startsWith(ENV_PREFIX)));
  const { clientId, clientSecret } = render(
    { clientId: auth.clientId, clientSecret: auth.clientSecret },
    { connection, env: oauthEnv },
  );
  return { clientId: String(clientId), clientSecret: clientSecret ? String(clientSecret) : undefined };
}

/**
 * Where a connection stands with its OAuth. `auth` is undefined when the
 * manifest left the catalog. A token past `expiresAt` still counts as
 * connected while there is a refresh token to renew it.
 */
export function authStatusOf(
  auth: ManifestAuth | undefined,
  credentials: OAuth2Credentials | null | undefined,
  now = Date.now(),
): PluginAuthStatus {
  if (!auth || auth.type === "none") return "none";
  if (!credentials) return "missing";
  if (!credentials.accessToken) return "expired";
  const isPastExpiry = credentials.expiresAt !== undefined && credentials.expiresAt <= now;
  return isPastExpiry && !credentials.refreshToken ? "expired" : "connected";
}

/**
 * Whether connections can authorize at all: false when the client id comes
 * from env vars that aren't set. One filled per connection always counts.
 */
export function hasOAuth2Client(auth: OAuth2ManifestAuth, env: Record<string, string | undefined>): boolean {
  return /\{\{\s*connection\./.test(auth.clientId) || resolveOAuth2Client(auth, {}, env).clientId !== "";
}

/** The URL of the resource a discovered OAuth authorizes for, its placeholders filled from the connection config. */
export function resolveResource(auth: OAuth2DiscoveryManifestAuth, connection: JsonObject): string {
  return String(render(auth.resource, { connection }));
}
