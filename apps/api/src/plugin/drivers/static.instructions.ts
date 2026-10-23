import { Driver } from "#src/manifest/driver.js";
import { MAX_PLUGIN_INSTRUCTIONS } from "@snipet/shared";
import z from "zod";

import type { InstructionsDriver } from "../driver.js";

const optionsSchema = z.strictObject({
  text: z.string().max(MAX_PLUGIN_INSTRUCTIONS),
});
type StaticInstructionsOptions = z.infer<typeof optionsSchema>;

/** Instructions written in the manifest, for plugins whose service has none to give. */
export class StaticInstructionsDriver
  extends Driver(optionsSchema)
  implements InstructionsDriver<StaticInstructionsOptions>
{
  readonly key = "static";

  getInstructions(_connectionId: string, { text }: StaticInstructionsOptions): Promise<string | undefined> {
    return Promise.resolve(text || undefined);
  }
}
