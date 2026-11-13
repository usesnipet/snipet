import { Private, Public, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { Body, Controller, Get, HttpCode, Post, Put } from "@nestjs/common";
import { Ctx, ZodPipe } from "@snipet/server-common";
import { changeOwnPasswordSchema, loginSchema, refreshTokenSchema } from "@snipet/shared";

import { AuthService } from "./auth.service.js";

import type { RefreshToken, ChangeOwnPassword, Login } from "@snipet/shared";
import type { AppContext } from "#src/common/context/app-context.js";

@Private(UserAuth())
@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  login(@Ctx() ctx: AppContext, @Body(new ZodPipe(loginSchema)) dto: Login) {
    return this.service.login(ctx, dto);
  }

  /**
   * refresh/logout take the refresh token as proof of identity: the access
   * token may already be expired, which is exactly when refresh is called.
   */
  @Public()
  @Post("refresh")
  @HttpCode(200)
  refresh(@Ctx() ctx: AppContext, @Body(new ZodPipe(refreshTokenSchema)) dto: RefreshToken) {
    return this.service.refresh(ctx, dto.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  logout(@Ctx() ctx: AppContext, @Body(new ZodPipe(refreshTokenSchema)) dto: RefreshToken) {
    return this.service.logout(ctx, dto.refreshToken);
  }

  @Get("me")
  me(@Ctx() ctx: AppContext) {
    return this.service.me(ctx);
  }

  @Put("me/password")
  @HttpCode(204)
  changeOwnPassword(@Ctx() ctx: AppContext, @Body(new ZodPipe(changeOwnPasswordSchema)) dto: ChangeOwnPassword) {
    return this.service.changeOwnPassword(ctx, dto);
  }
}
