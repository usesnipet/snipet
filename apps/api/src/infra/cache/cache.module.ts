import { env } from "#src/env.js";
import { DynamicModule, Global, Module } from "@nestjs/common";

import { CacheStore } from "./cache.types.js";
import { LayeredCache } from "./layered-cache.service.js";
import { MemoryStore } from "./memory.store.js";
import { RedisStore } from "./redis.store.js";

/**
 * Global module exposing {@link LayeredCache}: an in-memory LRU layer in front
 * of a Redis layer, both honouring the same TTL. Depends only on `ioredis`.
 */
@Global()
@Module({})
export class CacheModule {
  static register(): DynamicModule {
    const layers: CacheStore[] = [];
    if (env.CACHE_MEMORY_ENABLED) {
      layers.push(
        new MemoryStore({
          lruSize: env.CACHE_MEMORY_LRU_SIZE,
          sweepMs: env.CACHE_MEMORY_SWEEP_MS,
          ttlMs: env.CACHE_TTL_MS,
        }),
      );
    }

    if (env.CACHE_REDIS_ENABLED) {
      layers.push(new RedisStore({ url: env.CACHE_REDIS_URL! }));
    }

    const provider = {
      provide: LayeredCache,
      useFactory: (): LayeredCache => new LayeredCache(layers, env.CACHE_TTL_MS),
    };

    return {
      module: CacheModule,
      providers: [provider],
      exports: [provider],
    };
  }
}
