import { env } from "#src/env.js";
import { open, seal } from "@snipet/server-common";

import type { JsonObject } from "@snipet/shared";
import type { ValueTransformer } from "typeorm";

/**
 * Column transformer sealing a connection's whole config: which fields are
 * secret is only known from the manifest, and a field someone forgot to mark
 * must not leak.
 */
export const sealConfig: ValueTransformer = {
  to: (value?: JsonObject | null) => (value ? seal(JSON.stringify(value), env.ENCRYPTION_KEY) : value),
  from: (value?: string | null) => (value ? (JSON.parse(open(value, env.ENCRYPTION_KEY)) as unknown) : value),
};
