import { randomBytes } from "node:crypto";

import { isSealed, maskSecrets, open, restoreSecrets, seal, SECRET_PLACEHOLDER } from "./secret-box.js";

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

  it("masks secrets and restores the untouched ones", () => {
    const stored = { apiKey: "sk-123", org: "acme" };
    const masked = maskSecrets(stored);
    expect(masked).toEqual({ apiKey: SECRET_PLACEHOLDER, org: SECRET_PLACEHOLDER });
    expect(restoreSecrets({ ...masked, org: "other", extra: SECRET_PLACEHOLDER }, stored)).toEqual({
      apiKey: "sk-123",
      org: "other",
    });
    expect(restoreSecrets({ apiKey: SECRET_PLACEHOLDER }, null)).toEqual({});
  });
});
