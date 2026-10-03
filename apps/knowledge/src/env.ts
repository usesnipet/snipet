import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import z from "zod";

// Monorepo root .env (same depth from src/ and dist/). Vars already set in
// the environment win; the file is optional (e.g. in production).
const rootEnvFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(rootEnvFile, "utf8")))) {
    process.env[key] ??= value;
  }
}

const envSchema = z.object({
  KNOWLEDGE_PORT: z.coerce.number().int().default(8081),

  KNOWLEDGE_DATABASE_URL: z.string(),
  DB_AUTO_MIGRATE: z.stringbool().default(true),
});

export const env = envSchema.parse(process.env);
