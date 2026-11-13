import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { Body, Controller, Get, HttpCode, Put } from "@nestjs/common";
import { Role, updateSettingsSchema } from "@snipet/shared";
import { Ctx, ZodPipe } from "@snipet/server-common";

import { SettingsService } from "./settings.service.js";

import type { AppContext } from "#src/common/context/app-context.js";
import type { Settings, UpdateSettings } from "@snipet/shared";

@Private(UserAuth())
@Controller("settings")
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@Ctx() ctx: AppContext): Promise<Settings> {
    return this.service.get(ctx);
  }

  @Put()
  @HttpCode(204)
  @Private(UserAuth(Role.Admin))
  update(@Ctx() ctx: AppContext, @Body(new ZodPipe(updateSettingsSchema)) dto: UpdateSettings): Promise<void> {
    return this.service.update(ctx, dto);
  }
}
