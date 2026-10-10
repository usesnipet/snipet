import { mapBy } from "@snipet/server-common";

import type { ActionDriver, HealthCheckDriver } from "./driver.js";

// Catalog of drivers, fixed at startup.
export class DriverRegistry {
  private readonly actions: Map<string, ActionDriver>;
  private readonly healthChecks: Map<string, HealthCheckDriver>;

  constructor(drivers: { actions: ActionDriver[]; healthChecks: HealthCheckDriver[] }) {
    this.actions = mapBy(drivers.actions, "key");
    this.healthChecks = mapBy(drivers.healthChecks, "key");
  }

  hasActionDriver(key: string): boolean {
    return this.actions.has(key);
  }

  getActionDriver(key: string): ActionDriver {
    const d = this.actions.get(key);
    if (!d) throw new Error(`action driver "${key}" not found`);
    return d;
  }

  hasHealthCheckDriver(key: string): boolean {
    return this.healthChecks.has(key);
  }

  getHealthCheckDriver(key: string): HealthCheckDriver {
    const d = this.healthChecks.get(key);
    if (!d) throw new Error(`health check driver "${key}" not found`);
    return d;
  }
}
