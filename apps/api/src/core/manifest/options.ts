import { render } from "./template.js";

import type { JsonObject, ManifestDriver } from "@snipet/shared";
import type { BaseDriver } from "./driver.js";

/** What an authorized connection exposes to templates as `{{auth.x}}`. */
export interface ConnectionAuth {
  accessToken: string;
}

/**
 * Fills the driver options' `{{connection.x}}` and `{{auth.x}}` placeholders
 * from the connection config and its OAuth token, and has the driver parse
 * the result. The rendered options hold secrets: never log them or put them
 * in an error.
 */
export function resolveOptions<O>(
  driver: BaseDriver<O>,
  ref: ManifestDriver,
  connection: JsonObject,
  auth?: ConnectionAuth,
): O {
  return driver.validateOptions(render(ref.options, { connection, auth }));
}
