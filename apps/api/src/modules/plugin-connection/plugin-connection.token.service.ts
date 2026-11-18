import { resolveOAuth2Client } from "#src/core/manifest/oauth2.js";
import { PluginManifestRegistry } from "#src/core/plugin/plugin.registry.js";
import { OAuth2Error, refreshCredentials } from "#src/infra/oauth2/oauth2.js";
import { Injectable, Logger } from "@nestjs/common";
import { BaseService } from "@snipet/server-common";
import { EntityManager } from "typeorm";

import { PluginConnection } from "./plugin-connection.entity.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { OAuth2Credentials } from "#src/core/manifest/oauth2.js";
import type { ConnectionAuth } from "#src/core/manifest/options.js";
import type { JsonObject, ManifestAuth } from "@snipet/shared";

/**
 * A token closer than this to its expiry is renewed before use, so it outlives
 * the call (or the run) it's handed to.
 */
const EXPIRY_MARGIN_MS = 5 * 60_000;

/** Why an OAuth connection can't be used; ends up in `lastSyncedError` and the logs. */
export const NOT_AUTHORIZED = "plugin connection is not authorized";
export const AUTHORIZATION_EXPIRED = "plugin connection authorization expired, reconnect it";

/** What `authOf` needs from a connection. */
export type AuthorizableConnection = Pick<PluginConnection, "id" | "pluginKey" | "config" | "credentials">;

/**
 * Hands out a connection's OAuth access token, renewing it first when it's
 * about to expire. Kept apart from PluginConnectionService so the sync and the
 * run's store can use it without depending on the whole service.
 */
@Injectable()
export class PluginConnectionTokenService extends BaseService<AppContext> {
  private readonly logger = new Logger(PluginConnectionTokenService.name);

  constructor(
    manager: EntityManager,
    private readonly pluginManifestRegistry: PluginManifestRegistry,
  ) {
    super(manager);
  }

  /**
   * What the connection exposes to templates as `{{auth.x}}`: undefined when
   * its plugin has no OAuth. Throws when it was never authorized or the
   * provider refused to renew the token.
   */
  async authOf(ctx: AppContext, conn: AuthorizableConnection): Promise<ConnectionAuth | undefined> {
    const auth = this.pluginManifestRegistry.find(conn.pluginKey)?.auth;
    if (!auth || auth.type === "none") return undefined;
    const credentials = conn.credentials;
    if (!credentials) throw new Error(NOT_AUTHORIZED);
    if (!credentials.accessToken) throw new Error(AUTHORIZATION_EXPIRED);
    if (isFresh(credentials)) return { accessToken: credentials.accessToken };
    return { accessToken: await this.refresh(ctx, conn.id, auth, conn.config) };
  }

  /**
   * Renews the token under a row lock: providers that rotate refresh tokens
   * invalidate the old one, so two concurrent refreshes would log each other
   * out. Whoever waited on the lock reuses the token the first one got.
   */
  // ponytail: holds the row lock during the provider call (10 s timeout at most); fine at this scale.
  private async refresh(ctx: AppContext, id: string, auth: OAuthManifestAuth, config: JsonObject): Promise<string> {
    const outcome = await this.transaction(ctx, async (ctx): Promise<RefreshOutcome> => {
      const repository = this.repositoryOf(ctx, PluginConnection);
      const locked = await repository
        .createQueryBuilder("connection")
        .setLock("pessimistic_write")
        .where({ id })
        .getOne();
      const current = locked?.credentials;
      if (!current) return { error: NOT_AUTHORIZED };
      if (!current.accessToken) return { error: AUTHORIZATION_EXPIRED };
      if (isFresh(current)) return { accessToken: current.accessToken };

      // A discovered provider renews with the client registered there; a manifest's with its own.
      const oauth =
        current.discovered ??
        (auth.type === "oauth2"
          ? { provider: auth, client: resolveOAuth2Client(auth, config, process.env) }
          : undefined);
      if (!oauth) return { error: NOT_AUTHORIZED };
      try {
        const renewed = await refreshCredentials(oauth.provider, oauth.client, current);
        await repository.update(id, { credentials: { ...renewed, discovered: current.discovered } });
        return { accessToken: renewed.accessToken };
      } catch (err) {
        if (!(err instanceof OAuth2Error && err.code === "invalid_grant")) throw err;
        // Revoked or expired for good: drop the access token so the connection shows as expired.
        this.logger.warn(`oauth refresh for connection ${id}: ${err.code}`);
        await repository.update(id, {
          credentials: { ...current, accessToken: undefined },
          lastSyncedError: AUTHORIZATION_EXPIRED,
        });
        return { error: AUTHORIZATION_EXPIRED };
      }
    });
    // Thrown outside the transaction, so the expired state above is committed.
    if (outcome.error !== undefined) throw new Error(outcome.error);
    return outcome.accessToken;
  }
}

/** A manifest auth that goes through OAuth. */
type OAuthManifestAuth = Exclude<ManifestAuth, { type: "none" }>;

/** A refresh's result: the token, or why there is none. */
type RefreshOutcome = { accessToken: string; error?: undefined } | { error: string; accessToken?: undefined };

/** Whether the token outlives the margin; one without an expiry never goes stale. */
function isFresh(credentials: OAuth2Credentials, now = Date.now()): boolean {
  return credentials.expiresAt === undefined || credentials.expiresAt - EXPIRY_MARGIN_MS > now;
}
