import type { PluginCapability } from "@snipet/shared";

import { PluginValidationError } from "./errors.js";
import { render } from "./template.js";

// Fills the capability's option placeholders from the connection config and
// has the driver parse the result. The rendered options hold secrets: never
// log them or put them in an error.
export function resolveOptions<O>(
  driver: { validateOptions(options: unknown): O },
  capability: PluginCapability,
  connection: Record<string, unknown>,
): O {
  let options: unknown;
  try {
    options = render(capability.options, { connection });
  } catch (err) {
    throw new PluginValidationError(err instanceof Error ? err.message : String(err));
  }
  return driver.validateOptions(options);
}
