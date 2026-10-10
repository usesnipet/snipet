import { z } from "zod";

import { validateOptions } from "./utils.js";

import type { HealthCheckDriver, HealthCheckResult } from "../driver.js";
const optionsSchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  method: z.enum(["GET", "HEAD"]).default("GET"),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().min(1).default(10), // seconds
});
type HttpHealthOptions = z.infer<typeof optionsSchema>;

// Healthy when the url answers with a 2xx status.
export class HttpHealthCheckDriver implements HealthCheckDriver<HttpHealthOptions> {
  readonly key = "http";

  validateOptions(options: unknown): HttpHealthOptions {
    return validateOptions<HttpHealthOptions>(optionsSchema, options);
  }

  async checkHealth(
    _connectionId: string,
    { url, method, headers, timeout }: HttpHealthOptions,
  ): Promise<HealthCheckResult> {
    try {
      const res = await fetch(url, { method, headers, signal: AbortSignal.timeout(timeout * 1000) });
      return res.ok ? { isHealthy: true } : { isHealthy: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return { isHealthy: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
