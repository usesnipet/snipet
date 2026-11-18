import { resolveOAuth2Client } from "#src/core/manifest/oauth2.js";
import { env } from "#src/env.js";
import { buildAuthorizeUrl, createPkce, exchangeCode, OAuth2Error, revokeToken } from "#src/infra/http/oauth2.js";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { open, seal } from "@snipet/server-common";

import { PluginConnectionService } from "./plugin-connection.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { OAuth2Client } from "#src/core/manifest/oauth2.js";
import type { OAuth2ManifestAuth, PluginConnectionAuthorization } from "@snipet/shared";
import type { PluginConnection } from "./plugin-connection.entity.js";

/** Where providers send the user back; register it as the redirect URI of every OAuth app. */
export const OAUTH_CALLBACK_PATH = "/api/oauth/callback";

/** How long the user has to go through the provider's consent page. */
const STATE_TTL_MS = 10 * 60_000;

/** A provider's `error` is echoed to the web app only when it looks like an OAuth error code. */
const ERROR_CODE = /^[a-z0-9_.-]{1,64}$/i;

/**
 * What the `state` param carries through the provider. Sealed with
 * ENCRYPTION_KEY, so it can be neither forged nor read (it holds the PKCE
 * verifier), and nothing has to be stored between authorize and callback.
 */
interface OAuthState {
  connectionId: string;
  codeVerifier?: string;
  returnTo: string;
  expiresAt: number;
}

/** Query of the provider's redirect to the callback (RFC 6749 §4.1.2). */
export interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
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
    const { auth, client } = this.oauthOf(ctx, conn);
    const pkce = auth.pkce ? createPkce() : undefined;
    const state: OAuthState = {
      connectionId: id,
      codeVerifier: pkce?.verifier,
      returnTo,
      expiresAt: Date.now() + STATE_TTL_MS,
    };
    const url = buildAuthorizeUrl(auth, client, {
      state: seal(JSON.stringify(state), env.ENCRYPTION_KEY),
      redirectUri: redirectUri(),
      codeChallenge: pkce?.challenge,
    });
    return { url };
  }

  /**
   * Finishes the authorization and returns where to send the user: the web
   * app, with `oauth=success|error` in the query. Never throws, the user is
   * always sent somewhere they can see what happened.
   */
  async callback(ctx: AppContext, query: OAuthCallbackQuery): Promise<string> {
    // ponytail: a state can be replayed until it expires; harmless while providers keep codes single-use.
    const state = openState(query.state);
    if (!state) return webUrl("/", { oauth: "error", reason: "invalid_state" });
    const back = (params: Record<string, string>) =>
      webUrl(state.returnTo, { connectionId: state.connectionId, ...params });

    if (query.error || !query.code) return back({ oauth: "error", reason: errorCode(query.error ?? "missing_code") });
    try {
      const conn = await this.pluginConnectionService.findById(ctx, state.connectionId);
      const { auth, client } = this.oauthOf(ctx, conn);
      const credentials = await exchangeCode(auth, client, {
        code: query.code,
        redirectUri: redirectUri(),
        codeVerifier: state.codeVerifier,
      });
      await this.pluginConnectionService.saveCredentials(ctx, conn.id, credentials);
      void this.pluginConnectionService.sync(ctx, conn.id);
      return back({ oauth: "success" });
    } catch (err) {
      const reason = err instanceof OAuth2Error ? errorCode(err.code) : "failed";
      this.logger.warn(`oauth callback for connection ${state.connectionId}: ${(err as Error).message}`);
      return back({ oauth: "error", reason });
    }
  }

  /** Revokes the tokens at the provider (best effort) and forgets them. */
  async disconnect(ctx: AppContext, id: string): Promise<void> {
    const conn = await this.pluginConnectionService.findById(ctx, id);
    const token = conn.credentials?.refreshToken ?? conn.credentials?.accessToken;
    const manifest = this.pluginConnectionService.listManifests(ctx).find((m) => m.key === conn.pluginKey);
    if (token && manifest?.auth.type === "oauth2") {
      const client = resolveOAuth2Client(manifest.auth, conn.config, process.env);
      // The user wants out either way; a provider that won't revoke must not keep the tokens here.
      await revokeToken(manifest.auth, client, token).catch((err: Error) =>
        this.logger.warn(`oauth revoke for connection ${id}: ${err.message}`),
      );
    }
    if (conn.credentials) await this.pluginConnectionService.saveCredentials(ctx, id, null);
  }

  /** The connection's OAuth settings, its client resolved; 400 when the plugin has no OAuth or no client. */
  private oauthOf(ctx: AppContext, conn: PluginConnection): { auth: OAuth2ManifestAuth; client: OAuth2Client } {
    const { auth } = this.pluginConnectionService.getManifest(ctx, conn.pluginKey);
    if (auth.type !== "oauth2") throw new BadRequestException(`plugin "${conn.pluginKey}" doesn't use OAuth`);
    const client = resolveOAuth2Client(auth, conn.config, process.env);
    if (!client.clientId) throw new BadRequestException(`OAuth client of plugin "${conn.pluginKey}" is not configured`);
    return { auth, client };
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

/** The state, or undefined when it's missing, tampered with or expired. */
function openState(sealed: string | undefined): OAuthState | undefined {
  if (!sealed) return undefined;
  try {
    const state = JSON.parse(open(sealed, env.ENCRYPTION_KEY)) as OAuthState;
    return state.expiresAt > Date.now() ? state : undefined;
  } catch {
    return undefined;
  }
}

/** `code` when it looks like an OAuth error code, else a generic one: it ends up in a URL shown to the user. */
function errorCode(code: string): string {
  return ERROR_CODE.test(code) ? code : "failed";
}
