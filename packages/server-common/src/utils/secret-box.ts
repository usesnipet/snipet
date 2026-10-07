import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Sealed format: "v1:<iv>:<tag>:<ciphertext>", each part base64url.
const PREFIX = "v1";

export function seal(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [PREFIX, iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(":");
}

export function open(sealed: string, key: Buffer): string {
  const [prefix, iv, tag, data] = sealed.split(":");
  if (prefix !== PREFIX || !iv || !tag || data === undefined) throw new Error("malformed sealed value");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function isSealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

// Secrets are write-only over the API: responses carry this placeholder in
// place of each value, and a request that sends it back keeps the stored one.
export const SECRET_PLACEHOLDER = "__secret__";

export function maskSecrets(secrets: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.keys(secrets).map((key) => [key, SECRET_PLACEHOLDER]));
}

// Swaps placeholders in `incoming` for the `stored` values; a placeholder with
// nothing stored under its key is dropped.
export function restoreSecrets<T extends Record<string, unknown>>(
  incoming: T,
  stored: Record<string, unknown> | null | undefined,
): T {
  const entries = Object.entries(incoming)
    .map(([key, value]) => [key, value === SECRET_PLACEHOLDER ? stored?.[key] : value])
    .filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
}
