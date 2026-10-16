import { jest } from "@jest/globals";

import { Debugger } from "./debugger.js";

type Write = (file: string, json: string) => Promise<void>;

// A Debugger whose writes land in files, as parsed JSON.
function setup(write?: Write) {
  const files = new Map<string, unknown>();
  const onError = jest.fn();
  const d = new Debugger(write ?? ((file, json) => Promise.resolve(void files.set(file, JSON.parse(json)))), onError);
  return { d, files, onError };
}

describe("Debugger", () => {
  it("does nothing without a writer", async () => {
    const d = new Debugger();
    d.update("a", 1);
    d.append("b", 2);
    await expect(d.save()).resolves.toBeUndefined();
    expect(d.enabled).toBe(false);
  });

  it("writes each key to its own file and each appended item to a numbered one", async () => {
    const { d, files } = setup();
    const history = [{ role: "user" }];
    d.append("turns", { messages: history });
    history.push({ role: "assistant" });
    d.append("turns", 2);
    d.update("run", { id: "r1" });
    await d.save();

    expect(files.get("run.json")).toEqual({ id: "r1" });
    // Snapshotted when appended, not when saved.
    expect(files.get("turns/0001.json")).toMatchObject({ messages: [{ role: "user" }] });
    expect(files.get("turns/0002.json")).toMatchObject({ value: 2 });
    expect(files.get("turns/0002.json")).toHaveProperty("at");
  });

  it("only writes what changed since the last save", async () => {
    const write = jest.fn<Write>(() => Promise.resolve());
    const { d } = setup(write);
    d.update("agent", { name: "a" });
    d.append("turns", {});
    await d.save();
    d.append("turns", {});
    await d.save();
    await d.save();

    expect(write.mock.calls.map(([file]) => file)).toEqual(["agent.json", "turns/0001.json", "turns/0002.json"]);
  });

  it("writes saves in order and survives a failed write", async () => {
    const written: number[] = [];
    let release!: () => void;
    const slow = new Promise<void>((resolve) => (release = resolve));
    const write = jest
      .fn<Write>()
      .mockImplementationOnce(async (_, json) => {
        await slow;
        written.push(JSON.parse(json) as number);
      })
      .mockRejectedValueOnce(new Error("disk full"))
      .mockImplementation((_, json) => Promise.resolve(void written.push(JSON.parse(json) as number)));
    const { d, onError } = setup(write);

    const saves = [1, 2, 3].map((v) => {
      d.update("v", v);
      return d.save();
    });
    release();
    await Promise.all(saves);

    expect(written).toEqual([1, 3]);
    expect(onError).toHaveBeenCalledWith("v.json", expect.any(Error));
  });
});
