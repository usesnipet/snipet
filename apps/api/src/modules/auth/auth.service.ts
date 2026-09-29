import { createHash, randomBytes } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import type { AuthResponse, ChangeOwnPassword, Login } from "@snipet/shared";
import { compare } from "bcryptjs";
import { IsNull, Repository } from "typeorm";

import type { AccessTokenPayload } from "../../common/guards/auth.guard.js";
import { env } from "../../env.js";
import { User } from "../user/user.entity.js";
import { UserService } from "../user/user.service.js";
import { RefreshToken } from "./refresh-token.entity.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Compared against when the user doesn't exist, so a missing username takes
// as long as a wrong password.
const DUMMY_HASH = "$2b$10$iAUNUSSZXAaWjiua2JVePebu/Y89bK0ftvKbhFFWk/jjafAjD5.ee";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async login(dto: Login): Promise<AuthResponse> {
    const user = await this.users.findByUsernameWithPassword(dto.username);
    const valid = await compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) throw new UnauthorizedException("invalid credentials");
    return this.issueTokens(user);
  }

  // Trades a valid refresh token for a new pair and revokes the old one.
  async refresh(token: string): Promise<AuthResponse> {
    const record = await this.refreshTokens.findOneBy({ hash: hashToken(token), revokedAt: IsNull() });
    if (!record || record.expiresAt < new Date()) throw new UnauthorizedException("invalid refresh token");

    // Conditional revoke: of two concurrent refreshes with the same token, only one wins.
    const { affected } = await this.refreshTokens.update(
      { id: record.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!affected) throw new UnauthorizedException("invalid refresh token");

    return this.issueTokens(await this.users.findById(record.userId));
  }

  // Idempotent: an unknown or already revoked token is not an error.
  async logout(token: string): Promise<void> {
    await this.refreshTokens.update({ hash: hashToken(token), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  me(userId: string): Promise<User> {
    return this.users.findById(userId);
  }

  // Needs the current password, and revokes every refresh token so sessions
  // opened before the change don't outlive it.
  async changeOwnPassword(userId: string, dto: ChangeOwnPassword): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user || !(await compare(dto.currentPassword, user.password))) {
      throw new UnauthorizedException("current password is incorrect");
    }
    await this.users.setPassword(userId, dto.newPassword);
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: env.JWT_EXPIRES_IN_SECONDS });

    const refreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000);
    await this.refreshTokens.insert({
      userId: user.id,
      hash: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
    });

    const { password, ...publicUser } = user;
    return {
      accessToken,
      expiresAt: new Date(Date.now() + env.JWT_EXPIRES_IN_SECONDS * 1000),
      refreshToken,
      refreshExpiresAt,
      user: publicUser,
    };
  }
}
