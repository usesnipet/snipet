import { CacheStore } from "./cache.types.js";

interface Entry {
  value: unknown;
  /** Epoch ms when the entry expires; `0` means it never expires. */
  expiresAt: number;
}

export interface MemoryStoreOptions {
  /** Max entries kept; the least-recently-used are evicted past this. */
  lruSize?: number;
  /** Default TTL in ms applied when `set` receives none. `0` disables expiry. */
  ttlMs?: number;
  /** Background sweep interval in ms for expired entries. `0` disables it. */
  sweepMs?: number;
  /**
   * Deep-clone values on read so a caller mutating a returned object cannot
   * corrupt the cached copy shared by later reads. Default `true`.
   */
  useClone?: boolean;
}

/**
 * In-process LRU cache with per-entry TTL. Backed by a `Map`, whose insertion
 * order is used as the recency list: reads and writes move the key to the end,
 * evictions take from the front.
 */
export class MemoryStore implements CacheStore {
  private readonly map = new Map<string, Entry>();
  private readonly lruSize: number;
  private readonly ttlMs: number;
  private readonly useClone: boolean;
  private readonly timer?: NodeJS.Timeout;

  constructor(opts: MemoryStoreOptions = {}) {
    this.lruSize = opts.lruSize ?? 5000;
    this.ttlMs = opts.ttlMs ?? 0;
    this.useClone = opts.useClone ?? true;

    const sweepMs = opts.sweepMs ?? 60_000;
    if (sweepMs > 0) {
      this.timer = setInterval(() => this.sweep(), sweepMs);
      this.timer.unref?.();
    }
  }

  get<T = unknown>(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }

    // Re-insert to mark as most-recently-used.
    this.map.delete(key);
    this.map.set(key, entry);
    return this.clone(entry.value) as T;
  }

  ttl(key: string): number | undefined {
    const entry = this.map.get(key);
    if (!entry || !entry.expiresAt) return undefined;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    const ttl = ttlMs ?? this.ttlMs;
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: ttl > 0 ? Date.now() + ttl : 0 });

    if (this.map.size > this.lruSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  del(key: string): void {
    this.map.delete(key);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.map.clear();
  }

  private clone<V>(value: V): V {
    if (!this.useClone || value === null || typeof value !== "object") return value;
    try {
      return structuredClone(value);
    } catch {
      return value;
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.map.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) this.map.delete(key);
    }
  }
}
