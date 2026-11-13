import { Logger } from "@nestjs/common";
import { jest } from "@jest/globals";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadManifests } from "./load-manifest.js";

describe("loadManifests", () => {
  let first: string;
  let second: string;

  beforeAll(() => {
    first = mkdtempSync(join(tmpdir(), "manifests-"));
    second = mkdtempSync(join(tmpdir(), "manifests-"));
    writeFileSync(join(first, "b.json"), JSON.stringify({ key: "b" }));
    writeFileSync(join(first, "a.json"), JSON.stringify({ key: "a" }));
    writeFileSync(join(first, "broken.json"), "{");
    writeFileSync(join(first, "ignored.txt"), "not a manifest");
    writeFileSync(join(second, "c.json"), JSON.stringify({ key: "c" }));
  });

  afterAll(() => {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  });

  it("parses the *.json of each dir, keeping the dirs' order, and skips what can't be read", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const sources = await loadManifests([first, join(first, "missing"), second])("plugin");

    expect(sources).toEqual([
      { source: join(first, "a.json"), raw: { key: "a" } },
      { source: join(first, "b.json"), raw: { key: "b" } },
      { source: join(second, "c.json"), raw: { key: "c" } },
    ]);
    expect(warn).toHaveBeenCalledTimes(2); // broken.json and the missing dir
    warn.mockRestore();
  });
});
