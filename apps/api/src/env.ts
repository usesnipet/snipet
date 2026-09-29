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
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string(),
  // Run pending migrations on boot.
  DB_AUTO_MIGRATE: z.stringbool().default(true),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60),

  // First admin, created when the users table is empty. Without a password a
  // random one is generated and logged once.
  ROOT_USERNAME: z.string().default("admin"),
  ROOT_PASSWORD: z.union([z.literal(""), z.string().min(8)]).optional(),
});

export const env = envSchema.parse(process.env);
