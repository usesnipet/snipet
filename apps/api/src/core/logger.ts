/** Where the core writes logs; Nest's `Logger` satisfies it as is. */
export abstract class Logger {
  abstract log(message: unknown): void;
  abstract warn(message: unknown): void;
  abstract error(message: unknown): void;
}
