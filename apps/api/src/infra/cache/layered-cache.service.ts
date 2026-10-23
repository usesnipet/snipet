import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

import { CacheRunOptions, CacheStore } from "./cache.types.js";

/** Runs a layer call that may be sync or async; a sync throw becomes a rejection. */
const attempt = (fn: () => Promise<void> | void): Promise<void> => Promise.resolve().then(fn);

/** For log lines: a thrown value isn't always an Error. */
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Facade over an ordered list of cache layers (fastest first, e.g. memory then
 * Redis). A read walks the layers until a hit, then backfills every faster layer
 * it skipped using the hit layer's remaining TTL (so a per-instance copy never
 * outlives the shared entry); a write and a delete fan out to all layers. A
 * failure in one layer is logged and never propagated, so the cache stays
 * best-effort.
 */
@Injectable()
export class LayeredCache implements CacheStore, OnModuleDestroy {
  private readonly logger = new Logger(LayeredCache.name);
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly layers: CacheStore[],
    private readonly defaultTtlMs = 0,
  ) {}

  async get<T = unknown>(key: string): Promise<T | undefined> {
    for (let i = 0; i < this.layers.length; i++) {
      try {
        const hit = await this.layers[i].get<T>(key);
        if (hit === undefined) continue;

        if (i > 0) {
          const remaining = await Promise.resolve(this.layers[i].ttl?.(key)).catch(() => void 0);
          const backfillTtl = remaining ?? this.defaultTtlMs;
          await Promise.all(
            this.layers.slice(0, i).map((layer) => attempt(() => layer.set(key, hit, backfillTtl)).catch(() => void 0)),
          );
        }
        return hit;
      } catch (e) {
        this.logger.warn(`layer ${i} get failed key=${key}: ${errorMessage(e)}`);
      }
    }

    return undefined;
  }

  async run<T = unknown>(key: string, fn: () => Promise<T>, opts?: CacheRunOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined && !opts?.force) return cached;

    const load = async (): Promise<T> => {
      const res = await fn();
      await this.set(key, res, opts?.ttlMs ?? this.defaultTtlMs);
      return res;
    };

    const singleFlight = opts?.singleFlight ?? true;
    if (!singleFlight || opts?.force) return load();

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const pending = load().finally(() => {
      if (this.inflight.get(key) === pending) this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await Promise.all(
      this.layers.map((layer, i) =>
        attempt(() => layer.set(key, value, ttlMs)).catch((e: unknown) =>
          this.logger.warn(`layer ${i} set failed key=${key}: ${errorMessage(e)}`),
        ),
      ),
    );
  }

  async del(key: string): Promise<void> {
    await Promise.all(
      this.layers.map((layer, i) =>
        attempt(() => layer.del(key)).catch((e: unknown) =>
          this.logger.warn(`layer ${i} del failed key=${key}: ${errorMessage(e)}`),
        ),
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const layer of this.layers) {
      try {
        await layer.dispose?.();
      } catch {
        // best-effort cleanup
      }
    }
  }
}
