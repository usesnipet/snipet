// An action as listed by a driver.
export interface Action {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// The outcome of an action call, flattened to text.
export interface ActionResult {
  content: string;
  isError: boolean;
}

export interface ActionDriver<Opts = unknown> {
  readonly key: string;
  validateOptions(options: unknown): Opts;
  listActions(connectionId: string, options: Opts): Promise<Action[]>;
  callAction(
    connectionId: string,
    name: string,
    parameters: Record<string, unknown>,
    options: Opts,
  ): Promise<ActionResult>;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  error?: string;
}

export interface HealthCheckDriver<Opts = unknown> {
  readonly key: string;
  validateOptions(options: unknown): Opts;
  checkHealth(connectionId: string, options: Opts): Promise<HealthCheckResult>;
}
