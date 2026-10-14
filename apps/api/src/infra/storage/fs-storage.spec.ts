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

  it("puts, gets and deletes a file by key", async () => {
    await storage.put("agents/a.txt", Buffer.from("hi"));
    expect(await text((await storage.get("agents/a.txt"))!.body)).toBe("hi");

    await storage.delete("agents/a.txt");
    expect(await storage.get("agents/a.txt")).toBeNull();
    await expect(storage.delete("agents/a.txt")).resolves.toBeUndefined();
  });

  it("stores a data URL under a fresh key", async () => {
    const key = await storage.putDataUrl("agents", `data:image/png;base64,${Buffer.from("png").toString("base64")}`);
    expect(key).toMatch(/^agents\/[\w-]+\.png$/);
    expect(await text((await storage.get(key))!.body)).toBe("png");
  });

  it("rejects keys that escape the root", async () => {
    for (const key of ["../x", "a/../../x", "/etc/passwd", ".hidden", "a//b"]) {
      await expect(storage.get(key)).rejects.toThrow("Invalid file key");
    }
  });
});
