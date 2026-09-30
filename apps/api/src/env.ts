import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import z from "zod";

// Monorepo root .env (same depth from src/ and dist/). Vars already set in
// the environment win; the file is optional (e.g. in production).
const rootEnvFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvFile)) {
  // Not process.loadEnvFile: it writes the real process.env, which jest sandboxes.
  for (const [key, value] of Object.entries(parseEnv(readFileSync(rootEnvFile, "utf8")))) {
    process.env[key] ??= value;
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string(),
  // Run pending migrations on boot.
  DB_AUTO_MIGRATE: z.stringbool().default(true),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60), // 15 minutes
  REFRESH_TOKEN_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60), // 30 days

  ENCRYPTION_KEY: z
    .string()
    .transform((v) => Buffer.from(v, "base64"))
    .refine((b) => b.length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded"),

  // First admin, created when the users table is empty. Without a password a
  // random one is generated and logged once.
  ROOT_USERNAME: z.string().default("admin"),
  ROOT_PASSWORD: z.union([z.literal(""), z.string()]).optional(),

  // Seconds between MCP server tool syncs; 0 disables periodic syncs.
  MCP_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(300),

  // Set on release builds; otherwise the short commit hash (see system.service).
  APP_VERSION: z.string().default("dev"),
});

export const env = envSchema.parse(process.env);
