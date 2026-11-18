import { Controller, Get, Query, Redirect } from "@nestjs/common";
import { Ctx } from "@snipet/server-common";

import { Public } from "#src/common/decorators/auth.decorator.js";

import { PluginConnectionOAuthService } from "./plugin-connection.oauth.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { OAuthCallbackQuery } from "./plugin-connection.oauth.service.js";

/**
 * Where OAuth providers send the user back. Public: the browser arrives from
 * the provider without our token, and the sealed `state` is what ties the
 * request to a connection.
 */
@Public()
@Controller("oauth")
export class OAuthController {
  constructor(private readonly pluginConnectionOAuthService: PluginConnectionOAuthService) {}

  @Get("callback")
  @Redirect()
  async callback(@Ctx() ctx: AppContext, @Query() query: Record<string, unknown>) {
    return { url: await this.pluginConnectionOAuthService.callback(ctx, pickStrings(query)) };
  }
}

/** The query's string params only: express turns `?code[]=x` into an array. */
function pickStrings(query: Record<string, unknown>): OAuthCallbackQuery {
  const string = (value: unknown) => (typeof value === "string" ? value : undefined);
  return { code: string(query.code), state: string(query.state), error: string(query.error) };
}
