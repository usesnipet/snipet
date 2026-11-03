import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import z from "zod";

/**
 * Monorepo root .env (same depth from src/ and dist/). Vars already set in
 * the environment win; the file is optional (e.g. in production).
 */
const rootEnvFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvFile)) {
  // Not process.loadEnvFile: it writes the real process.env, which jest sandboxes.
  for (const [key, value] of Object.entries(parseEnv(readFileSync(rootEnvFile, "utf8")))) {
    process.env[key] ??= value;
  }
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().default(8852),
    // Base URL the server is reached at, used to build public file URLs.
    // Defaults to http://localhost:$PORT.
    PUBLIC_URL: z
      .url()
      .optional()
      .transform((v) => v?.replace(/\/+$/, "")),

    // The built web app, served when it holds an index.html. Defaults to
    // apps/web/dist (same depth from src/ and dist/).
    WEB_DIR: z.string().default(resolve(import.meta.dirname, "../../web/dist")),

    DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/postgres"),
    DB_AUTO_MIGRATE: z.stringbool().default(true),

    JWT_SECRET: z.string().min(32).default("change-me"),
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(900), // 15 minutes
    REFRESH_TOKEN_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(2_592_000), // 30 days

    ENCRYPTION_KEY: z
      .string()
      .default("Y2opZ3fylU+VmHmdi9qSmJwdCGZbOHQ46WR1AgP21VU=")
      .transform((v) => Buffer.from(v, "base64"))
      .refine((b) => b.length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded"),

    // First admin, created when the users table is empty. Without a password a
    // random one is generated and logged once.
    ROOT_USERNAME: z.string().default("admin"),
    ROOT_PASSWORD: z.union([z.literal(""), z.string()]).optional(),

    // Plugin manifests (*.json). Defaults to apps/api/plugins (same depth from src/ and dist/).
    PLUGINS_DIR: z.string().default(resolve(import.meta.dirname, "../plugins")),
    LLMS_DIR: z.string().default(resolve(import.meta.dirname, "../llms")),

    // CACHE
    CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000), // 1 minute

    CACHE_REDIS_ENABLED: z.stringbool().default(false),
    CACHE_REDIS_URL: z.url().optional(),

    CACHE_MEMORY_ENABLED: z.stringbool().default(true),
    CACHE_MEMORY_LRU_SIZE: z.coerce.number().int().positive().default(5000),
    CACHE_MEMORY_SWEEP_MS: z.coerce.number().int().positive().default(300_000), // 5 minutes

    // Where uploaded files (e.g. agent avatars) live: the local filesystem or an
    // S3 / S3-compatible bucket.
    STORAGE_DRIVER: z.enum(["fs", "s3"]).default("fs"),
    // Defaults to apps/api/storage (same depth from src/ and dist/).
    STORAGE_FS_DIR: z.string().default(resolve(import.meta.dirname, "../storage")),
    STORAGE_S3_ENDPOINT: z.string().optional(), // empty means AWS S3
    STORAGE_S3_REGION: z.string().default("us-east-1"),
    STORAGE_S3_BUCKET: z.string().optional(),
    STORAGE_S3_PREFIX: z.string().default(""),
    STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_S3_FORCE_PATH_STYLE: z.stringbool().default(false),

    // Origins allowed to call the API from a browser (the widget's host pages),
    // comma-separated; "*" allows any. Unset disables CORS.
    CORS_ORIGINS: z
      .string()
      .optional()
      .transform((v) =>
        v === "*"
          ? true
          : v
              ?.split(",")
              .map((o) => o.trim())
              .filter(Boolean),
      ),

    // Express "trust proxy": set behind a reverse proxy so the client IP (used by
    // rate limits) comes from X-Forwarded-For. A hop count, "true", or a list of
    // proxy addresses/subnets. Unset trusts none.
    TRUST_PROXY: z
      .string()
      .optional()
      .transform((v) => (v === "true" ? true : v === "false" ? false : v && /^\d+$/.test(v) ? Number(v) : v)),

    // New anonymous end users one IP can create per hour (refreshes don't count).
    ANONYMOUS_SIGNUPS_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(30),
    // Agent runs one app end user (app token) can start per minute.
    AGENT_RUNS_PER_END_USER_PER_MINUTE: z.coerce.number().int().positive().default(10),

    // Set on release builds.
    APP_VERSION: z.string().default("dev"),
  })
  .refine((e) => e.STORAGE_DRIVER !== "s3" || e.STORAGE_S3_BUCKET, {
    message: "STORAGE_S3_BUCKET is required when STORAGE_DRIVER=s3",
    path: ["STORAGE_S3_BUCKET"],
  })
  .refine((e) => !e.CACHE_REDIS_ENABLED || e.CACHE_REDIS_URL, {
    message: "CACHE_REDIS_URL is required when CACHE_REDIS_ENABLED=true",
    path: ["CACHE_REDIS_URL"],
  })
  .transform((e) => ({ ...e, PUBLIC_URL: e.PUBLIC_URL ?? `http://localhost:${e.PORT}` }));

export const env = envSchema.parse(process.env);
