import { assertKey } from "#src/infra/storage/utils.js";
import { slugify } from "#src/utils/slug/slug.js";
import moment from "moment";

import type { HookEvent } from "@snipet/shared/core";
/**
 * Where an event is saved:
 * <date>/<agent slug>_<agent id>/<session id>/<run id>/<time>_<hook>_<event id>.json,
 * so a run's folder lists its events in the order they happened. Validated, as
 * ids reach the file system and bucket keys.
 */
export function debugPath(event: HookEvent): string {
  const runDate = moment(event.run.createdAt).format("YYYY-MM-DD");
  const runTime = moment(event.run.createdAt).format("HH-mm-ss");
  const occurredAt = moment(event.occurredAt).format("HH-mm-ss");
  const agentFolder = `${slugify(event.agent.name) || "agent"}_${event.agent.id}`;
  const fileName = `${occurredAt}_${event.hook}_${event.id.slice(0, 8)}.json`;
  const path = `${runDate}/${agentFolder}/session_${event.run.sessionId}/run_${runTime}_${event.run.id}/${fileName}`;
  assertKey(path);
  return path;
}

/** The file's content: the whole event, indented to be read by hand. */
export const eventJson = (event: HookEvent) => Buffer.from(JSON.stringify(event, null, 2));
