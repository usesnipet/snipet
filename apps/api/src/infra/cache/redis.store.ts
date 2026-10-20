import { Logger } from "@nestjs/common";
import { Redis, RedisOptions } from "ioredis";

import { CacheStore } from "./cache.types.js";

export interface RedisStoreOptions {
  /** Connection string, e.g. `redis://localhost:6379`. */
  url: string;
  /** Optional prefix prepended to every key by ioredis. */
  keyPrefix?: string;
  /** Extra ioredis options merged over the cache-friendly defaults. */
  redisOptions?: RedisOptions;
}

/**
 * Redis-backed cache layer. Values are JSON serialized. The client fails fast
 * while disconnected (`enableOfflineQueue: false`) so a Redis outage degrades to
 * a cache miss instead of hanging the caller.
 */
export class RedisStore implements CacheStore {
  private readonly logger = new Logger(RedisStore.name);
  private readonly client: Redis;

  constructor(opts: RedisStoreOptions) {
    this.client = new Redis(opts.url, {
      keyPrefix: opts.keyPrefix,
      lazyConnect: false,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 10_000,
      ...opts.redisOptions,
    });

    this.client.on("error", (e) => this.logger.warn(`redis error: ${e instanceof Error ? e.message : e}`));
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    if (raw == null) return undefined;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (raw === undefined) return;

    if (ttlMs && ttlMs > 0) await this.client.set(key, raw, "PX", ttlMs);
    else await this.client.set(key, raw);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async ttl(key: string): Promise<number | undefined> {
    // PTTL: -2 = missing, -1 = no expiry.
    const ms = await this.client.pttl(key);
    return ms >= 0 ? ms : undefined;
  }

  async dispose(): Promise<void> {
    await this.client.quit().catch(() => void 0);
  }
}
