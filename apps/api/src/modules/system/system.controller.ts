import { Controller, Get } from "@nestjs/common";

import { SystemService } from "./system.service.js";

import type { SystemInfo } from "@snipet/shared";
import { Public } from "../../common/decorators/auth.decorator.js";

@Public()
@Controller("system")
export class SystemController {
  constructor(private readonly service: SystemService) {}

  @Get("info")
  info(): SystemInfo {
    return this.service.info();
  }
}
