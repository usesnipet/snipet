import { Injectable } from "@nestjs/common";
import { execFileSync } from "node:child_process";

import { env } from "../../env.js";

import type { SystemInfo } from "@snipet/shared";

// APP_VERSION on release builds, else the short commit hash, else "dev".
function resolveVersion(): string {
  if (env.APP_VERSION) return env.APP_VERSION;
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

@Injectable()
export class SystemService {
  private readonly version = resolveVersion();

  info(): SystemInfo {
    return { version: this.version };
  }
}
