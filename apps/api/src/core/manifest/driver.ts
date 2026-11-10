import { z } from "zod";

import { CoreError, CoreErrorCode } from "../error.js";

/** What every driver has: a key to be found by and a parser for its options. */
export interface BaseDriver<Opts = unknown> {
  readonly key: string;
  validateOptions(options: unknown): Opts;
}

/**
 * Base class giving a driver `validateOptions` from a zod schema. Issues never
 * carry the input, so rendered secrets stay out of the error.
 * @example class FooDriver extends Driver(optionsSchema) implements ToolDriver<FooOptions> {}
 */
export function Driver<Opts>(optionsSchema: z.ZodType<Opts>) {
  return class Driver {
    validateOptions(options: unknown): Opts {
      const res = optionsSchema.safeParse(options);
      if (!res.success) {
        throw new CoreError(CoreErrorCode.INVALID_DRIVER_OPTIONS, "invalid driver options", res.error.issues);
      }
      return res.data;
    }
  };
}
