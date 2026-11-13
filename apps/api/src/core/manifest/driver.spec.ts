import { z } from "zod";

import { CoreError } from "../error.js";
import { Driver } from "./driver.js";

class TestDriver extends Driver(z.strictObject({ url: z.url(), timeout: z.number().default(10) })) {
  readonly key = "test";
}

describe("Driver", () => {
  it("parses the options and fills defaults", () => {
    expect(new TestDriver().validateOptions({ url: "https://x.dev" })).toEqual({ url: "https://x.dev", timeout: 10 });
  });

  it("throws a CoreError without the input in it", () => {
    const run = () => new TestDriver().validateOptions({ url: "secret-value" });
    expect(run).toThrow(CoreError);
    try {
      run();
    } catch (err) {
      const { message, details } = err as CoreError;
      expect(JSON.stringify({ message, details })).not.toContain("secret-value");
    }
  });
});
