import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";

import { FsStorage } from "./fs-storage.js";

describe("FsStorage", () => {
  let dir: string;
  let storage: FsStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "fs-storage-"));
    storage = new (class extends FsStorage {
      protected override root = dir;
    })();
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("puts, gets and deletes a file by prefix and key", async () => {
    await storage.put("files", "agents/a.txt", Buffer.from("hi"));
    expect(await text((await storage.get("files", "agents/a.txt"))!.body)).toBe("hi");
    expect(await storage.get("other", "agents/a.txt")).toBeNull();

    await storage.delete("files", "agents/a.txt");
    expect(await storage.get("files", "agents/a.txt")).toBeNull();
    await expect(storage.delete("files", "agents/a.txt")).resolves.toBeUndefined();
  });

  it("lists and deletes dirs", async () => {
    await storage.put("debug", "2026-10-01/a/r.json", Buffer.from("1"));
    await storage.put("debug", "2026-10-02/r.json", Buffer.from("2"));
    expect((await storage.list("debug")).sort()).toEqual(["2026-10-01", "2026-10-02"]);
    expect(await storage.list("debug", "2026-10-01")).toEqual(["a"]);
    expect(await storage.list("missing")).toEqual([]);

    await storage.deleteDir("debug", "2026-10-01");
    expect(await storage.list("debug")).toEqual(["2026-10-02"]);
    await expect(storage.deleteDir("debug", "2026-10-01")).resolves.toBeUndefined();
    await expect(storage.deleteDir("debug", "")).rejects.toThrow("Invalid file key");
  });

  it("rejects keys that escape the prefix", async () => {
    for (const key of ["../x", "a/../../x", "/etc/passwd", ".hidden", "a//b"]) {
      await expect(storage.get("files", key)).rejects.toThrow("Invalid file key");
    }
  });
});
