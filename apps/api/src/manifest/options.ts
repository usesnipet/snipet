import { render } from "./template.js";

import type { JsonObject, ManifestDriver } from "@snipet/shared";
import type { BaseDriver } from "./driver.js";

/**
 * Fills the driver options' `{{connection.x}}` placeholders from the
 * connection config and has the driver parse the result. The rendered options
 * hold secrets: never log them or put them in an error.
 */
export function resolveOptions<O>(driver: BaseDriver<O>, ref: ManifestDriver, connection: JsonObject): O {
  return driver.validateOptions(render(ref.options, { connection }));
}
