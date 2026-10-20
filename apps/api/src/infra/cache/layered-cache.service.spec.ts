import { jest } from "@jest/globals";
import { Logger } from "@nestjs/common";

import { CacheStore } from "./cache.types.js";
import { LayeredCache } from "./layered-cache.service.js";
import { MemoryStore } from "./memory.store.js";

/** A mock resolving to `value`; `never` so it fits any CacheStore method, generic ones included. */
const resolves = (value?: unknown) => jest.fn(() => Promise.resolve(value)) as never;

/** A mock rejecting with `message`. */
const rejects = (message: string) => jest.fn(() => Promise.reject(new Error(message))) as never;

function stubStore(overrides: Partial<CacheStore> = {}): CacheStore {
  return { get: resolves(), set: resolves(), del: resolves(), ...overrides };
}

describe("LayeredCache", () => {
  let fast: MemoryStore;
  let slow: MemoryStore;
  let cache: LayeredCache;

  beforeEach(() => {
    fast = new MemoryStore({ sweepMs: 0 });
    slow = new MemoryStore({ sweepMs: 0 });
    cache = new LayeredCache([fast, slow]);
  });

  afterEach(async () => {
    await cache.onModuleDestroy();
  });

  describe("get", () => {
    it("returns undefined when every layer misses", async () => {
      expect(await cache.get("missing")).toBeUndefined();
    });

    it("returns a first-layer hit without reading slower layers", async () => {
      fast.set("user", 1);
      slow.set("user", 2);
      const slowGet = jest.spyOn(slow, "get");

      expect(await cache.get("user")).toBe(1);
      expect(slowGet).not.toHaveBeenCalled();
    });

    it("backfills faster layers when a slower layer hits", async () => {
      slow.set("user", 1);

      expect(fast.get("user")).toBeUndefined();
      expect(await cache.get("user")).toBe(1);
      expect(fast.get("user")).toBe(1);
    });

    it("treats a cached null as a hit", async () => {
      slow.set("user", null);

      expect(await cache.get("user")).toBeNull();
      expect(fast.get("user")).toBeNull();
    });

    it("backfills every layer faster than the one that hit", async () => {
      const mid = new MemoryStore({ sweepMs: 0 });
      const three = new LayeredCache([fast, mid, slow]);
      slow.set("user", 1);

      expect(await three.get("user")).toBe(1);
      expect(fast.get("user")).toBe(1);
      expect(mid.get("user")).toBe(1);

      await three.onModuleDestroy();
    });

    it("backfills with the remaining TTL of the layer that hit", async () => {
      slow.set("user", 1, 1000);

      await cache.get("user");

      const remaining = fast.ttl("user");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);
    });

    it("backfills with defaultTtlMs when the hit layer has no remaining TTL", async () => {
      cache = new LayeredCache([fast, slow], 1000);
      slow.set("user", 1);

      await cache.get("user");

      const remaining = fast.ttl("user");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);
    });

    it("backfills with defaultTtlMs when ttl() rejects", async () => {
      const failingTtl = stubStore({
        get: resolves(1),
        ttl: rejects("ttl failed"),
      });
      const frontSet = resolves();
      const layered = new LayeredCache([stubStore({ set: frontSet }), failingTtl], 42);

      expect(await layered.get("user")).toBe(1);
      expect(frontSet).toHaveBeenCalledWith("user", 1, 42);

      await layered.onModuleDestroy();
    });

    it("skips a layer whose get throws and still returns a slower hit", async () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
      const broken = stubStore({
        get: rejects("boom"),
      });
      const layered = new LayeredCache([broken, slow]);
      slow.set("user", 1);

      expect(await layered.get("user")).toBe(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("layer 0 get failed key=user: boom"));

      warn.mockRestore();
      await layered.onModuleDestroy();
    });

    it("still returns the hit when backfill set fails", async () => {
      const front = stubStore({
        set: rejects("set failed"),
      });
      const layered = new LayeredCache([front, slow]);
      slow.set("user", 1);

      await expect(layered.get("user")).resolves.toBe(1);

      await layered.onModuleDestroy();
    });
  });

  describe("set", () => {
    it("writes the value to every layer", async () => {
      await cache.set("user", 1);

      expect(slow.get("user")).toBe(1);
      expect(fast.get("user")).toBe(1);
    });

    it("passes ttlMs through to every layer", async () => {
      await cache.set("user", 1, 1000);

      expect(fast.ttl("user")).toBeGreaterThan(0);
      expect(slow.ttl("user")).toBeGreaterThan(0);
    });

    it("logs a layer failure and does not throw", async () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
      const broken = stubStore({
        set: rejects("set failed"),
      });
      const layered = new LayeredCache([broken, slow]);

      await expect(layered.set("user", 1)).resolves.toBeUndefined();
      expect(slow.get("user")).toBe(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("layer 0 set failed key=user: set failed"));

      warn.mockRestore();
      await layered.onModuleDestroy();
    });
  });

  describe("del", () => {
    it("removes the key from every layer", async () => {
      await cache.set("user", 1);

      await cache.del("user");

      expect(fast.get("user")).toBeUndefined();
      expect(slow.get("user")).toBeUndefined();
    });

    it("is a no-op when the key is missing", async () => {
      await expect(cache.del("missing")).resolves.toBeUndefined();
    });

    it("logs a layer failure and does not throw", async () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
      const broken = stubStore({
        del: rejects("del failed"),
      });
      const layered = new LayeredCache([broken, slow]);
      slow.set("user", 1);

      await expect(layered.del("user")).resolves.toBeUndefined();
      expect(slow.get("user")).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("layer 0 del failed key=user: del failed"));

      warn.mockRestore();
      await layered.onModuleDestroy();
    });
  });

  describe("run", () => {
    it("returns the cached value without calling fn", async () => {
      await cache.set("user", 1);
      const fn = jest.fn(() => Promise.resolve(2));

      expect(await cache.run("user", fn)).toBe(1);
      expect(fn).not.toHaveBeenCalled();
    });

    it("treats a cached null as a hit", async () => {
      await cache.set("user", null);
      const fn = jest.fn(() => Promise.resolve(1));

      expect(await cache.run("user", fn)).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    it("loads, caches, and returns the value on a miss", async () => {
      const fn = jest.fn(() => Promise.resolve(1));

      expect(await cache.run("user", fn)).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fast.get("user")).toBe(1);
      expect(slow.get("user")).toBe(1);
    });

    it("reruns fn and overwrites the cache when force is true", async () => {
      await cache.set("user", 1);
      const fn = jest.fn(() => Promise.resolve(2));

      expect(await cache.run("user", fn, { force: true })).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(await cache.get("user")).toBe(2);
    });

    it("stores the result with opts.ttlMs", async () => {
      await cache.run("user", () => Promise.resolve(1), { ttlMs: 1000 });

      expect(fast.ttl("user")).toBeGreaterThan(0);
      expect(slow.ttl("user")).toBeGreaterThan(0);
    });

    it("stores the result with defaultTtlMs when opts.ttlMs is omitted", async () => {
      cache = new LayeredCache([fast, slow], 1000);

      await cache.run("user", () => Promise.resolve(1));

      const remaining = fast.ttl("user");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);
    });

    it("coalesces concurrent run calls for the same key into one fn execution", async () => {
      let started!: () => void;
      const startedP = new Promise<void>((resolve) => {
        started = resolve;
      });
      let finish!: (value: string) => void;
      const fn = jest.fn(
        () =>
          new Promise<string>((resolve) => {
            started();
            finish = resolve;
          }),
      );

      const first = cache.run("user", fn);
      await startedP;
      const second = cache.run("user", fn);
      finish("loaded");

      expect(await first).toBe("loaded");
      expect(await second).toBe("loaded");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not coalesce concurrent run calls when singleFlight is false", async () => {
      let n = 0;
      const fn = jest.fn(() => Promise.resolve(++n));

      const [a, b] = await Promise.all([
        cache.run("user", fn, { singleFlight: false }),
        cache.run("user", fn, { singleFlight: false }),
      ]);

      expect(fn).toHaveBeenCalledTimes(2);
      expect([a, b].sort()).toEqual([1, 2]);
    });

    it("does not join an in-flight run when force is true", async () => {
      let started!: () => void;
      const startedP = new Promise<void>((resolve) => {
        started = resolve;
      });
      let finishFirst!: (value: number) => void;
      const firstFn = jest.fn(
        () =>
          new Promise<number>((resolve) => {
            started();
            finishFirst = resolve;
          }),
      );
      const secondFn = jest.fn(() => Promise.resolve(2));

      const first = cache.run("user", firstFn);
      await startedP;
      const second = cache.run("user", secondFn, { force: true });

      expect(await second).toBe(2);
      finishFirst(1);
      expect(await first).toBe(1);
      expect(firstFn).toHaveBeenCalledTimes(1);
      expect(secondFn).toHaveBeenCalledTimes(1);
    });

    it("does not share in-flight work across different keys", async () => {
      const fnA = jest.fn(() => Promise.resolve("a"));
      const fnB = jest.fn(() => Promise.resolve("b"));

      const [a, b] = await Promise.all([cache.run("a", fnA), cache.run("b", fnB)]);

      expect(a).toBe("a");
      expect(b).toBe("b");
      expect(fnA).toHaveBeenCalledTimes(1);
      expect(fnB).toHaveBeenCalledTimes(1);
    });

    it("clears in-flight state so a later miss runs fn again", async () => {
      expect(await cache.run("user", () => Promise.resolve(1))).toBe(1);
      await cache.del("user");

      const fn = jest.fn(() => Promise.resolve(2));
      expect(await cache.run("user", fn)).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("onModuleDestroy", () => {
    it("disposes every layer that implements dispose", async () => {
      const dispose = jest.fn<() => void>();
      const layered = new LayeredCache([stubStore({ dispose })]);

      await layered.onModuleDestroy();

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("swallows a dispose failure so shutdown stays best-effort", async () => {
      const layered = new LayeredCache([
        stubStore({
          dispose: rejects("dispose failed"),
        }),
      ]);

      await expect(layered.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
