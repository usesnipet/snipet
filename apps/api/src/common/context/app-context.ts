import { UnauthorizedException } from "@nestjs/common";
import { BaseContext } from "@snipet/server-common";

import type { AppTokenPayload } from "@snipet/shared";
import type { ApiKey } from "#src/modules/api-key/api-key.entity.js";
import type { AuthUser, RequestAuth } from "../guards/strategies/auth-strategy.js";

/** The API's context. New fields go here, readonly, each with its own `withX`. */
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

  /** The logged-in user; throws when the request didn't authenticate as one. */
  get user(): AuthUser {
    if (this.auth?.type !== "user") throw new UnauthorizedException("not authenticated as a user");
    return this.auth.user;
  }

  /** The key that authenticated the request; throws when something else did. */
  get apiKey(): ApiKey {
    if (this.auth?.type !== "apiKey") throw new UnauthorizedException("not authenticated with an api key");
    return this.auth.apiKey;
  }

  /** The app token's payload; throws when the request didn't use one. */
  get appToken(): AppTokenPayload {
    if (this.auth?.type !== "appToken") throw new UnauthorizedException("not authenticated with an app token");
    return this.auth.token;
  }
}
