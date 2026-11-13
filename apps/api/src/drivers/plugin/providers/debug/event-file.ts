import { assertKey } from "#src/infra/storage/utils.js";
import { slugify } from "#src/utils/slug/slug.js";
import moment from "moment";

import type { HookEvent } from "@snipet/shared/core";
/**
 * Where an event is saved:
 * <run date>/<agent slug>_<agent id>/session_<session id>/run_<run time>_<run id>/<time>_<hook>_<event id>.json,
 * in UTC so the path doesn't depend on the server's timezone, and to the
 * millisecond so a run's folder lists its events in the order they happened.
 * Validated, as ids reach the file system and bucket keys.
 */
export function debugPath(event: HookEvent): string {
  const runDate = moment.utc(event.run.createdAt).format("YYYY-MM-DD");
  const runTime = moment.utc(event.run.createdAt).format("HH-mm-ss");
  const occurredAt = moment.utc(event.occurredAt).format("HH-mm-ss.SSS");
  const agentFolder = `${slugify(event.agent.name) || "agent"}_${event.agent.id}`;
  const fileName = `${occurredAt}_${event.hook}_${event.id.slice(0, 8)}.json`;
  const path = `${runDate}/${agentFolder}/session_${event.run.sessionId}/run_${runTime}_${event.run.id}/${fileName}`;
  assertKey(path);
  return path;
}

/** The file's content: the whole event, indented to be read by hand. */
export const eventJson = (event: HookEvent) => Buffer.from(JSON.stringify(event, null, 2));
