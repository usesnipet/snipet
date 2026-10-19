import { env } from "#src/env.js";
import { BadRequestException } from "@nestjs/common";

/** Stored keys ("agents/x.webp") are served under /api/files/. */
const base = `${env.PUBLIC_URL}/api/files/`;

/** Public URL of a storage key. Plain concatenation: path.join would collapse the "//" in "http://". */
export const toStorageUrl = (key: string) => base + key;

export const fromStorageUrl = (url: string) => (url.startsWith(base) ? url.slice(base.length) : url);

/** The storage key of a stored path or its public URL. */
export const storageKeyOf = (pathOrUrl: string) => fromStorageUrl(pathOrUrl);

/**
 * Path segments of letters, digits, "-", "_" and "."; no segment starts with
 * a dot, so "..", hidden files and absolute keys are out.
 */
const KEY_RE = /^[\w-][\w.-]*(\/[\w-][\w.-]*)*$/;

export function assertKey(key: string): void {
  if (!KEY_RE.test(key)) throw new BadRequestException("Invalid file key");
}

/** The validated path of key (or of the prefix itself) inside prefix. */
export function storagePath(prefix: string, key = ""): string {
  const path = key ? `${prefix}/${key}` : prefix;
  assertKey(path);
  return path;
}
