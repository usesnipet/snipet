import { Controller, Get } from "@nestjs/common";

import { Public } from "@snipet/server-common";

import { SystemService } from "./system.service.js";

import type { SystemInfo } from "@snipet/shared";

@Controller("system")
export class SystemController {
  constructor(private readonly service: SystemService) {}

  @Public()
  @Get("info")
  info(): SystemInfo {
    return this.service.info();
  }
}
