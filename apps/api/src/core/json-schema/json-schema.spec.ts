import { CoreError } from "../error.js";

import { isValidJsonSchema, parseJsonSchema } from "./json-schema.js";

describe("parseJsonSchema", () => {
  const schema = {
    type: "object",
    properties: {
      url: { type: "string" },
      retries: { type: "number", default: 3 },
    },
    required: ["url"],
  };

  it("fills defaults and rejects invalid data", () => {
    expect(parseJsonSchema(schema, { url: "x" })).toEqual({ url: "x", retries: 3 });
    expect(() => parseJsonSchema(schema, { retries: 1 })).toThrow(CoreError);
    expect(parseJsonSchema(null, { any: 1 })).toEqual({ any: 1 });
  });
});

describe("isValidJsonSchema", () => {
  const validSchema = {
    type: "object",
    properties: {
      url: { type: "string" },
      retries: { type: "number", default: 3 },
    },
    required: ["url"],
  };

  // Unknown keywords are allowed by JSON Schema; an unknown type isn't.
  const invalidSchema = { type: "nope" };

  it("returns true if the schema is valid", () => {
    expect(isValidJsonSchema(validSchema)).toBe(true);
    expect(isValidJsonSchema(invalidSchema)).toBe(false);
  });
});
