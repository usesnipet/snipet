import { resolveOAuth2Client, resolveResource } from "#src/core/manifest/oauth2.js";
import { env } from "#src/env.js";
import { discoverProvider, isClientExpired, registerClient } from "#src/infra/oauth2/discovery.js";
import { exchangeCode, OAuth2Error, openCallback, revokeToken, startAuthorization } from "#src/infra/oauth2/oauth2.js";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import { PluginConnectionService } from "./plugin-connection.service.js";
import { authorizedOAuthOf } from "./plugin-connection.token.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { OAuth2CallbackQuery, OAuth2Client, OAuth2Provider } from "#src/infra/oauth2/oauth2.js";
import type { OAuth2DiscoveryManifestAuth, PluginConnectionAuthorization } from "@snipet/shared";
import type { DiscoveredOAuth2, PluginConnection } from "./plugin-connection.entity.js";

/** Where providers send the user back; register it as the redirect URI of every OAuth app. */
export const OAUTH_CALLBACK_PATH = "/api/oauth/callback";

/** A provider's `error` is echoed to the web app only when it looks like an OAuth error code. */
const ERROR_CODE = /^[a-z0-9_.-]{1,64}$/i;

/** The name a discovered provider shows for the clients registered there. */
const CLIENT_NAME = "Snipet";

/** What the `state` carries through the provider, sealed with ENCRYPTION_KEY. */
interface ConnectionAuthorization {
  connectionId: string;
  /** The web app path the user comes back to. */
  returnTo: string;
  /** The provider and client found on authorize, stored with the tokens once they come. */
  discovered?: DiscoveredOAuth2;
}

/** Who to authorize with; `discovered` when they were found rather than taken from the manifest. */
interface ConnectionOAuth {
  provider: OAuth2Provider;
  client: OAuth2Client;
  discovered?: DiscoveredOAuth2;
}

/**
 * The OAuth authorization code flow of plugin connections: sends the user to
 * the provider, stores the tokens it gives back, and revokes them.
 */
@Injectable()
export class PluginConnectionOAuthService {
  private readonly logger = new Logger(PluginConnectionOAuthService.name);

  constructor(private readonly pluginConnectionService: PluginConnectionService) {}

  /** The provider's consent page for the connection; the user comes back to `returnTo` in the web app. */
  async authorize(ctx: AppContext, id: string, returnTo: string): Promise<PluginConnectionAuthorization> {
    const conn = await this.pluginConnectionService.findById(ctx, id);
    const { provider, client, discovered } = await this.oauthOf(ctx, conn);
    const url = startAuthorization<ConnectionAuthorization>(provider, client, {
      redirectUri: redirectUri(),
      data: { connectionId: id, returnTo, discovered },
      key: env.ENCRYPTION_KEY,
    });
    return { url };
  }

  /**
   * Finishes the authorization and returns where to send the user: the web
   * app, with `oauth=success|error` in the query. Never throws, the user is
   * always sent somewhere they can see what happened.
   */
  async callback(ctx: AppContext, query: OAuth2CallbackQuery): Promise<string> {
    const callback = openCallback<ConnectionAuthorization>(query, env.ENCRYPTION_KEY);
    if (!callback) return webUrl("/", { oauth: "error", reason: "invalid_state" });
    const { connectionId, returnTo, discovered } = callback.data;
    const back = (params: Record<string, string>) => webUrl(returnTo, { connectionId, ...params });

    if (callback.error !== undefined) return back({ oauth: "error", reason: errorCode(callback.error) });
    try {
      const conn = await this.pluginConnectionService.findById(ctx, connectionId);
      // The client the code was issued to: the one registered on authorize, if any.
      const { provider, client } = discovered ?? (await this.oauthOf(ctx, conn));
      const tokens = await exchangeCode(provider, client, {
        code: callback.code,
        redirectUri: redirectUri(),
        codeVerifier: callback.codeVerifier,
      });
      await this.pluginConnectionService.saveCredentials(ctx, conn.id, { ...tokens, discovered });
      void this.pluginConnectionService.sync(ctx, conn.id);
      return back({ oauth: "success" });
    } catch (err) {
      const reason = err instanceof OAuth2Error ? errorCode(err.code) : "failed";
      this.logger.warn(`oauth callback for connection ${connectionId}: ${(err as Error).message}`);
      return back({ oauth: "error", reason });
    }
  }

  /** Revokes the tokens at the provider (best effort) and forgets them. */
  async disconnect(ctx: AppContext, id: string): Promise<void> {
    const conn = await this.pluginConnectionService.findById(ctx, id);
    if (!conn.credentials) return;
    const token = conn.credentials.refreshToken ?? conn.credentials.accessToken;
    const auth = this.pluginConnectionService.listManifests(ctx).find((m) => m.key === conn.pluginKey)?.auth;
    const oauth = authorizedOAuthOf(auth, conn.credentials, conn.config);
    if (token && oauth) {
      // The user wants out either way; a provider that won't revoke must not keep the tokens here.
      await revokeToken(oauth.provider, oauth.client, token).catch((err: Error) =>
        this.logger.warn(`oauth revoke for connection ${id}: ${err.message}`),
      );
    }
    await this.pluginConnectionService.saveCredentials(ctx, id, null);
  }

  /**
   * The provider and client the connection authorizes with; 400 when the
   * plugin has no OAuth or no client. A discovered provider is found and a
   * client registered there on first use, then reused while the resource and
   * the client's secret stay the same.
   */
  private async oauthOf(ctx: AppContext, conn: PluginConnection): Promise<ConnectionOAuth> {
    const { auth } = this.pluginConnectionService.getManifest(ctx, conn.pluginKey);
    if (auth.type === "none") throw new BadRequestException(`plugin "${conn.pluginKey}" doesn't use OAuth`);
    if (auth.type === "oauth2") {
      const client = resolveOAuth2Client(auth, conn.config, process.env);
      if (!client.clientId) {
        throw new BadRequestException(`OAuth client of plugin "${conn.pluginKey}" is not configured`);
      }
      return { provider: auth, client };
    }
    const discovered = await this.discoveredOf(conn, auth);
    return { provider: discovered.provider, client: discovered.client, discovered };
  }

  /**
   * The provider of the connection's resource and the client registered
   * there: the stored ones while the resource, the redirect URI and the
   * client's secret still hold, else found and registered again.
   */
  private async discoveredOf(conn: PluginConnection, auth: OAuth2DiscoveryManifestAuth): Promise<DiscoveredOAuth2> {
    const resourceUrl = resolveResource(auth, conn.config);
    if (!URL.canParse(resourceUrl)) throw new BadRequestException(`OAuth resource "${resourceUrl}" is not a URL`);
    const stored = conn.credentials?.discovered;
    const isReusable =
      stored?.resourceUrl === resourceUrl && stored.redirectUri === redirectUri() && !isClientExpired(stored.client);
    if (isReusable) return stored;
    try {
      const provider = await discoverProvider(resourceUrl, auth.scopes);
      const client = await registerClient(provider, { redirectUri: redirectUri(), clientName: CLIENT_NAME });
      return { resourceUrl, redirectUri: redirectUri(), provider, client };
    } catch (err) {
      if (!(err instanceof OAuth2Error)) throw err;
      throw new BadRequestException(`OAuth discovery for plugin "${conn.pluginKey}" failed: ${err.code}`);
    }
  }
}

/** The callback URL providers redirect to; must match the one registered in the OAuth app. */
function redirectUri(): string {
  return `${env.PUBLIC_URL}${OAUTH_CALLBACK_PATH}`;
}

/**
 * A path of the web app with `params` added to its query. A path that
 * resolves to another origin (URL parsing drops tabs and newlines, so
 * "/\t/evil.com" becomes "//evil.com") falls back to the web app's root.
 */
function webUrl(path: string, params: Record<string, string>): string {
  const base = new URL(`${env.WEB_URL}/`);
  let url = new URL(path, base);
  if (url.origin !== base.origin) url = base;
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url.toString();
}

/** `code` when it looks like an OAuth error code, else a generic one: it ends up in a URL shown to the user. */
function errorCode(code: string): string {
  return ERROR_CODE.test(code) ? code : "failed";
}
