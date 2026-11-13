import type { BaseDriver } from "./driver.js";

export interface HealthCheckResult {
  isHealthy: boolean;
  error?: string;
}

export interface HealthCheckDriver<Opts = unknown> extends BaseDriver<Opts> {
  checkHealth(options: Opts): Promise<HealthCheckResult>;
}
