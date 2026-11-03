import { Injectable, Logger } from "@nestjs/common";

import { HookRunner } from "./hook.runner.js";

import type { HookRunnerContext } from "./hook.runner.js";

/** Builds the hook runner of each run from the agent's hook handlers. */
@Injectable()
export class HookDispatcher {
  private readonly logger = new Logger(HookDispatcher.name);

  /** The run's hook runner; never throws, so loading hooks can't fail the run. */
  // eslint-disable-next-line @typescript-eslint/require-await
  async forRun(context: HookRunnerContext): Promise<HookRunner> {
    // TODO(phase 5): handlers from the agent's plugin connections with a `hooks` capability.
    return new HookRunner([], context, this.logger);
  }
}
