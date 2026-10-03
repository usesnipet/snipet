import { randomBytes } from "node:crypto";

import { isSealed, open, seal } from "./secret-box.js";

describe("secret-box", () => {
  const key = randomBytes(32);

  it("round-trips and uses a fresh iv", () => {
    const a = seal('{"apiKey":"sk-123"}', key);
    expect(isSealed(a)).toBe(true);
    expect(a).not.toContain("sk-123");
    expect(seal('{"apiKey":"sk-123"}', key)).not.toBe(a);
    expect(open(a, key)).toBe('{"apiKey":"sk-123"}');
  });

  it("rejects a wrong key or tampered data", () => {
    const sealed = seal("secret", key);
    expect(() => open(sealed, randomBytes(32))).toThrow();
    const parts = sealed.split(":");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => open(parts.join(":"), key)).toThrow();
  });
});
