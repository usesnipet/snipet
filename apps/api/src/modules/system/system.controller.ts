import { Public } from "#src/common/decorators/auth.decorator.js";
import { Controller, Get } from "@nestjs/common";

import { SystemService } from "./system.service.js";

import type { SystemInfo } from "@snipet/shared";
@Public()
@Controller("system")
export class SystemController {
  constructor(private readonly service: SystemService) {}

  @Get("info")
  info(): SystemInfo {
    return this.service.info();
  }

  @Get("health")
  health(): string {
    return "OK";
  }
}
