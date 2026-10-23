/**
 * Minimal cache contract shared by every layer and by the layered facade.
 * `get` resolves to `undefined` on a miss so callers can use a strict
 * `!== undefined` check (a cached `null` is a valid hit).
 */
export interface CacheStore {
  get<T = unknown>(key: string): Promise<T | undefined> | T | undefined;
  set(key: string, value: unknown, ttlMs?: number): Promise<void> | void;
  del(key: string): Promise<void> | void;
  /**
   * Optional: remaining time-to-live for `key` in ms. `undefined` when the store
   * cannot tell or the entry has no expiry. Used to backfill faster layers with
   * the slower layer's remaining TTL instead of a fresh full TTL.
   */
  ttl?(key: string): Promise<number | undefined> | number | undefined;
  /** Optional cleanup hook invoked on module destroy. */
  dispose?(): void | Promise<void>;
}

export interface CacheRunOptions {
  /** TTL in ms for cached entries. */
  ttlMs?: number;
  /** Force to run the function even if the entry is cached. */
  force?: boolean;
  /**
   * Coalesce concurrent `run` calls for the same key into one `fn()` execution.
   * Defaults to `true`. `force: true` still bypasses an in-flight call.
   */
  singleFlight?: boolean;
}

/** Named cache lifetimes a caller can ask for — the data source owns what each actually means (ms). */
export enum CacheDuration {
  Long = "long",
  Short = "short",
}
