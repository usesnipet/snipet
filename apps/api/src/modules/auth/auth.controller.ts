import { Body, Controller, Get, HttpCode, Post, Put } from "@nestjs/common";
import {
  changeOwnPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  type ChangeOwnPassword,
  type Login,
  type RefreshToken,
} from "@snipet/shared";

import { CurrentUser, Public, type AuthUser } from "../../common/decorators/auth.decorators.js";
import { ZodPipe } from "../../common/pipes/zod.pipe.js";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) dto: Login) {
    return this.service.login(dto);
  }

  // refresh/logout take the refresh token as proof of identity: the access
  // token may already be expired, which is exactly when refresh is called.
  @Public()
  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshTokenSchema)) dto: RefreshToken) {
    return this.service.refresh(dto.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  logout(@Body(new ZodPipe(refreshTokenSchema)) dto: RefreshToken) {
    return this.service.logout(dto.refreshToken);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user.id);
  }

  @Put("me/password")
  @HttpCode(204)
  changeOwnPassword(@CurrentUser() user: AuthUser, @Body(new ZodPipe(changeOwnPasswordSchema)) dto: ChangeOwnPassword) {
    return this.service.changeOwnPassword(user.id, dto);
  }
}
