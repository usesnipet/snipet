import { SetMetadata } from "@nestjs/common";

import { AUTH } from "../guards/strategies/auth-strategy.js";

import type { Role } from "@snipet/shared";
import type { AuthStrategy } from "../guards/strategies/auth-strategy.js";

/** `Authorization: Bearer <access token>`, optionally limited to these roles. */
export const UserAuth = (...roles: Role[]): AuthStrategy => ({ type: "user", roles });

/** `X-API-Key: <key>`. */
export const ApiKeyAuth = (): AuthStrategy => ({ type: "apiKey" });

/** `Authorization: Bearer <app token>`: an app's end user, e.g. from the widget. */
export const AppTokenAuth = (): AuthStrategy => ({ type: "appToken" });

/** On a class or method; the method's wins. Routes with neither are denied. */
export const Private = (...strategies: AuthStrategy[]) => SetMetadata(AUTH, strategies);
export const Public = () => SetMetadata(AUTH, []);
