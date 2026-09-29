import { existsSync } from "node:fs";
import { resolve } from "node:path";
import z from "zod";

// Monorepo root .env (same depth from src/ and dist/). Vars already set in
// the environment win; the file is optional (e.g. in production).
const rootEnvFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string(),
  // Run pending migrations on boot.
  DB_AUTO_MIGRATE: z.stringbool().default(true),
});

export const env = envSchema.parse(process.env);
