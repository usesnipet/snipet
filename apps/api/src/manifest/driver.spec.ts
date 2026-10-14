import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

import { Driver } from "./driver.js";

class TestDriver extends Driver(z.strictObject({ url: z.url(), timeout: z.number().default(10) })) {
  readonly key = "test";
}

describe("Driver", () => {
  it("parses the options and fills defaults", () => {
    expect(new TestDriver().validateOptions({ url: "https://x.dev" })).toEqual({ url: "https://x.dev", timeout: 10 });
  });

  it("throws a BadRequestException without the input in it", () => {
    const run = () => new TestDriver().validateOptions({ url: "secret-value" });
    expect(run).toThrow(BadRequestException);
    try {
      run();
    } catch (err) {
      expect(JSON.stringify((err as BadRequestException).getResponse())).not.toContain("secret-value");
    }
  });
});
