import { Injectable, Logger } from "@nestjs/common";

import { SettingsService } from "../settings/settings.service.js";

import { DebugStorage } from "./debug.storage.js";
import { Debugger, describeError } from "./debugger.js";

@Injectable()
export class DebugService {
  private readonly logger = new Logger(DebugService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly storage: DebugStorage,
  ) {}

  // Runs fn with a Debugger whose files go in the folder dir. It records only
  // when the agentDebugEnabled setting is on when fn starts. What's left is
  // saved when fn ends, with its error if it throws.
  async debug<T>(dir: string, fn: (d: Debugger) => Promise<T>): Promise<T> {
    const d = new Debugger(
      (await this.isEnabled()) ? (file, json) => this.storage.put(`${dir}/${file}`, json) : undefined,
      (file, err) => this.logger.warn(`save debug ${dir}/${file}: ${String(err)}`),
    );
    try {
      return await fn(d);
    } catch (err) {
      d.update("error", describeError(err));
      throw err;
    } finally {
      await d.save();
    }
  }

  // Debugging must never break what it watches.
  private async isEnabled(): Promise<boolean> {
    try {
      return (await this.settings.get()).agentDebugEnabled;
    } catch (err) {
      this.logger.warn(`read debug setting: ${String(err)}`);
      return false;
    }
  }
}
