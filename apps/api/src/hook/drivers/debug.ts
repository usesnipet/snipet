import { Storage } from "#src/infra/storage/storage.js";
import { Driver } from "#src/manifest/driver.js";
import { slugify } from "#src/utils/slug/slug.js";
import { z } from "zod";

import type { HookEvent, HookResult } from "@snipet/shared";
import type { HookDriver } from "../driver.js";

const PREFIX = "debug";

const optionsSchema = z.strictObject({});

type DebugOptions = z.infer<typeof optionsSchema>;

/**
 * Where an event is saved:
 * <date>/<agent slug>_<agent id>/<session id>/<run id>/<time>_<hook>_<event id>.json,
 * so a run's folder lists its events in the order they happened.
 */
export function debugPath(event: HookEvent): string {
  const [date, time] = event.occurredAt.replace("Z", "").split("T");
  const agent = `${slugify(event.agent.name) || "agent"}_${event.agent.id}`;
  return `${date}/${agent}/${event.run.sessionId}/${event.run.id}/${time.replaceAll(":", "-")}_${event.hook}_${event.id.slice(0, 8)}.json`;
}

/** Saves each event it gets as a JSON file in storage; only observes. */
export class DebugDriver extends Driver(optionsSchema) implements HookDriver<DebugOptions> {
  readonly key = "debug";

  constructor(private readonly storage: Storage) {
    super();
  }

  async handle(event: HookEvent): Promise<HookResult> {
    const json = Buffer.from(JSON.stringify(event, null, 2));
    await this.storage.put(PREFIX, debugPath(event), json, "application/json");
    return { action: "continue" };
  }
}
