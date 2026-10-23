import { jest } from "@jest/globals";
import { MemoryStore } from "./memory.store.js";

describe("MemoryStore", () => {
  describe("get", () => {
    it("returns undefined when the key is missing", async () => {
      const store = new MemoryStore({ sweepMs: 0 });

      expect(await store.get("missing")).toBeUndefined();

      store.dispose();
    });

    it("returns the stored value when the key is present", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1);

      expect(await store.get("key")).toBe(1);

      store.dispose();
    });

    it("returns the value when the TTL has not expired yet", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1, 1000);

      expect(await store.get("key")).toBe(1);

      store.dispose();
    });

    it("returns undefined when the key is expired", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1, 10);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await store.get("key")).toBeUndefined();

      store.dispose();
    });

    it("marks the key as most-recently-used so a later set evicts a different key", async () => {
      const store = new MemoryStore({ sweepMs: 0, lruSize: 2 });
      store.set("a", 1);
      store.set("b", 2);
      await store.get("a");
      store.set("c", 3);

      expect(await store.get("a")).toBe(1);
      expect(await store.get("b")).toBeUndefined();
      expect(await store.get("c")).toBe(3);

      store.dispose();
    });

    it("returns a clone so mutating the result does not corrupt the cache", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", { n: 1 });

      const first = store.get<{ n: number }>("key");
      first!.n = 2;

      expect(await store.get("key")).toEqual({ n: 1 });

      store.dispose();
    });

    it("returns the same reference when useClone is false", async () => {
      const store = new MemoryStore({ sweepMs: 0, useClone: false });
      store.set("key", { n: 1 });

      const first = store.get<{ n: number }>("key");
      first!.n = 2;

      expect(await store.get("key")).toEqual({ n: 2 });

      store.dispose();
    });
  });

  describe("set", () => {
    it("should store a value that can be retrieved by its key", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1);

      expect(await store.get("key")).toBe(1);

      store.dispose();
    });

    it("should replace the value of an already existing key", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1);
      store.set("key", 2);

      expect(await store.get("key")).toBe(2);

      store.dispose();
    });

    it("should remove the oldest entry when the LRU size is exceeded", async () => {
      const store = new MemoryStore({
        sweepMs: 0,
        lruSize: 2,
      });
      store.set("a", 1);
      store.set("b", 2);
      store.set("c", 3);

      expect(await store.get("a")).toBeUndefined();
      expect(await store.get("b")).toBe(2);
      expect(await store.get("c")).toBe(3);

      store.dispose();
    });

    it("should apply the default ttlMs when set receives none", async () => {
      const store = new MemoryStore({ sweepMs: 0, ttlMs: 10 });
      store.set("key", 1);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await store.get("key")).toBeUndefined();

      store.dispose();
    });
  });

  describe("del", () => {
    it("removes an existing key", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1);

      store.del("key");

      expect(await store.get("key")).toBeUndefined();

      store.dispose();
    });

    it("is a no-op when the key is missing", () => {
      const store = new MemoryStore({ sweepMs: 0 });

      expect(store.del("missing")).toBeUndefined();

      store.dispose();
    });
  });

  describe("ttl", () => {
    it("returns undefined when the key is missing", () => {
      const store = new MemoryStore({ sweepMs: 0 });

      expect(store.ttl("missing")).toBeUndefined();

      store.dispose();
    });

    it("returns undefined when the entry has no expiry", () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1);

      expect(store.ttl("key")).toBeUndefined();

      store.dispose();
    });

    it("returns the remaining time-to-live in ms", () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1, 1000);

      const remaining = store.ttl("key");

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);

      store.dispose();
    });

    it("returns undefined when the entry has already expired", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1, 10);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(store.ttl("key")).toBeUndefined();

      store.dispose();
    });
  });

  describe("dispose", () => {
    it("clears all entries", async () => {
      const store = new MemoryStore({ sweepMs: 0 });
      store.set("key", 1);

      store.dispose();

      expect(await store.get("key")).toBeUndefined();
    });
  });

  describe("sweep", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("removes expired entries on the sweep interval", async () => {
      const store = new MemoryStore({ sweepMs: 1000 });
      store.set("key", 1, 50);

      await jest.advanceTimersByTimeAsync(1000);

      expect(await store.get("key")).toBeUndefined();

      store.dispose();
    });
  });
});
