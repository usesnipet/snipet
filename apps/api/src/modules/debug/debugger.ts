/** Write of one file of the debug folder; absent when debugging is off. */
export type DebugWriter = (file: string, json: string) => Promise<void>;

export type Timed<T> = { result: T; startedAt: string; durationMs: number };

/**
 * Pretty JSON of value, serialized now so later mutations of the caller's
 * objects (a history that keeps growing) don't leak in.
 */
function toJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return JSON.stringify("[unserializable]");
  }
}

export function describeError(err: unknown) {
  return err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { message: String(err) };
}

/**
 * One debug folder, filled by its owner and written on save(): update(key)
 * is the file <key>.json, append(key) adds <key>/0001.json, <key>/0002.json...
 * save() writes only what changed since the last one. Without a writer every
 * method is a no-op, so callers never check whether it's on.
 */
export class Debugger {
  private readonly pending = new Map<string, string>();
  private readonly counts = new Map<string, number>();
  private saving: Promise<void> = Promise.resolve();

  constructor(
    private readonly write?: DebugWriter,
    private readonly onSaveError: (file: string, err: unknown) => void = () => {},
  ) {}

  get enabled(): boolean {
    return !!this.write;
  }

  update(key: string, value: unknown): void {
    if (this.write) this.pending.set(`${key}.json`, toJson(value));
  }

  /** Objects get an "at" timestamp. */
  append(key: string, value: unknown): void {
    if (!this.write) return;
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    const at = new Date().toISOString();
    const item = value && typeof value === "object" && !Array.isArray(value) ? { at, ...value } : { at, value };
    this.pending.set(`${key}/${String(n).padStart(4, "0")}.json`, toJson(item));
  }

  async time<T>(fn: () => Promise<T>): Promise<Timed<T>> {
    const startedAt = new Date();
    const result = await fn();
    return { result, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime() };
  }

  /**
   * Saves run one after another, so an older write of a file finishing late
   * never overwrites a newer one; a failed write is reported, never thrown.
   */
  save(): Promise<void> {
    const write = this.write;
    if (!write || this.pending.size === 0) return this.saving;
    const files = [...this.pending];
    this.pending.clear();
    this.saving = this.saving.then(async () => {
      await Promise.all(files.map(([file, json]) => write(file, json).catch((err) => this.onSaveError(file, err))));
    });
    return this.saving;
  }
}
