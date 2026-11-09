import { InternalServerErrorException } from "@nestjs/common";
import { BaseContext } from "@snipet/server-common";

import type { AppTokenPayload } from "@snipet/shared";
import type { ApiKey } from "#src/modules/api-key/api-key.entity.js";
import type { AuthUser, RequestAuth } from "../guards/strategies/auth-strategy.js";

/**
 * Who a session belongs to: the logged-in user, or an app, optionally on
 * behalf of one of its end users (the app token's, or the API key's pick).
 */
export type Owner =
  | { userId: string; appId: null; externalUserId: null; name: string | null }
  | { userId: null; appId: string; externalUserId: string | null; name: string | null };

/**
 * The API's context. New fields go here, readonly, each with its own `withX`.
 *
 * The auth getters throw 500, not 401: AuthGuard already rejected callers
 * without the route's credential, so reaching one with the wrong (or no) auth
 * means the route's @Private doesn't match what its code reads.
 */
export class AppContext extends BaseContext {
  /** How the request authenticated, set by AuthGuard on @Private routes. */
  readonly auth?: RequestAuth;

  private constructor(readonly requestId: string) {
    super();
  }

  /** Not frozen in the constructor: subclass fields are set after super(). */
  static create(requestId: string): AppContext {
    const ctx = new AppContext(requestId);
    Object.freeze(ctx);
    return ctx;
  }

  withAuth(auth: RequestAuth): this {
    // `Partial<this>` can't be checked against a concrete object while `this` is generic.
    return this.with({ auth } as Partial<this>);
  }

  /** The logged-in user. */
  get user(): AuthUser {
    return this.authOf("user").user;
  }

  /** The key that authenticated the request. */
  get apiKey(): ApiKey {
    return this.authOf("apiKey").apiKey;
  }

  /** The app token's payload. */
  get appToken(): AppTokenPayload {
    return this.authOf("appToken").token;
  }

  /** Who the request acts for, whichever credential it used. */
  get owner(): Owner {
    const auth = this.authOf();
    switch (auth.type) {
      case "user":
        return { userId: auth.user.id, appId: null, externalUserId: null, name: auth.user.name };
      case "appToken":
        return {
          userId: null,
          appId: auth.token.app.id,
          externalUserId: auth.token.sub,
          name: auth.token.user.name ?? null,
        };
      case "apiKey":
        return { userId: null, appId: auth.apiKey.appId, externalUserId: auth.externalUserId, name: null };
    }
  }

  /** The request's auth, of `type` when given; throws when it's missing or another type. */
  private authOf<T extends RequestAuth["type"]>(type?: T): Extract<RequestAuth, { type: T }> {
    if (!this.auth) throw new InternalServerErrorException("route reads the caller but isn't @Private");
    if (type && this.auth.type !== type) {
      throw new InternalServerErrorException(`route reads a ${type} but authenticated with ${this.auth.type}`);
    }
    return this.auth as Extract<RequestAuth, { type: T }>;
  }
}
