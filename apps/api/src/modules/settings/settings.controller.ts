import { Private, UserAuth } from "#src/common/decorators/auth.decorator.js";
import { Body, Controller, Get, HttpCode, Put } from "@nestjs/common";
import { Role, updateSettingsSchema } from "@snipet/shared";
import { ZodPipe } from "@snipet/server-common";

import { SettingsService } from "./settings.service.js";

import type { Settings, UpdateSettings } from "@snipet/shared";

@Private(UserAuth())
@Controller("settings")
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(): Promise<Settings> {
    return this.service.get();
  }

  @Put()
  @HttpCode(204)
  @Private(UserAuth(Role.Admin))
  update(@Body(new ZodPipe(updateSettingsSchema)) dto: UpdateSettings): Promise<void> {
    return this.service.update(dto);
  }
}
