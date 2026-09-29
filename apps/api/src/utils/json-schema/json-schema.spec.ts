import { validateJson } from "./json-schema.js";

describe("validateJson", () => {
  const schema = {
    type: "object",
    properties: {
      url: { type: "string" },
      retries: { type: "number", default: 3 },
    },
    required: ["url"],
  };

  it("fills defaults and rejects invalid data", () => {
    expect(validateJson(schema, { url: "x" })).toEqual({ url: "x", retries: 3 });
    expect(() => validateJson(schema, { retries: 1 })).toThrow("validation failed");
    expect(validateJson(null, { any: 1 })).toEqual({ any: 1 });
  });
});
