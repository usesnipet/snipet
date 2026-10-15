import { jest } from "@jest/globals";

import { FilesStorage } from "./files.storage.js";

import type { Storage } from "#src/infra/storage/storage.js";

describe("FilesStorage", () => {
  const storage = { put: jest.fn(() => Promise.resolve()) };
  const files = new FilesStorage(storage as unknown as Storage);

  it("stores a data URL under a fresh key in the files prefix", async () => {
    const key = await files.putDataUrl("agents", `data:image/png;base64,${Buffer.from("png").toString("base64")}`);
    expect(key).toMatch(/^agents\/[\w-]+\.png$/);
    expect(storage.put).toHaveBeenCalledWith("files", key, Buffer.from("png"), "image/png");
  });

  it("rejects anything but a base64 image", async () => {
    await expect(files.putDataUrl("agents", "data:text/plain;base64,AAAA")).rejects.toThrow("Expected a base64");
  });
});
