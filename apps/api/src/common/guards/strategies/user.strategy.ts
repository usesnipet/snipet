import { ForbiddenException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hasRole } from "@snipet/shared";

import { bearerToken } from "./auth-strategy.js";

import type { Role } from "@snipet/shared";
import type { Request } from "express";
import type { AuthStrategyHandler, RequestAuth, StrategyOptions } from "./auth-strategy.js";

/** What a dashboard access token carries. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
  /** Absent on tokens issued before it was added. */
  name?: string;
}

/** Dashboard users: a Bearer access token signed with JWT_SECRET. */
@Injectable()
export class UserStrategy implements AuthStrategyHandler<"user"> {
  constructor(private readonly jwt: JwtService) {}

  async authenticate(request: Request, { roles }: StrategyOptions<"user">): Promise<RequestAuth | null> {
    const token = bearerToken(request);
    if (!token) return null;
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token).catch(() => null);
    if (!payload) return null;
    if (!hasRole(payload.role, roles)) throw new ForbiddenException("insufficient role");
    return { type: "user", user: { id: payload.sub, role: payload.role, name: payload.name ?? null } };
  }
}
