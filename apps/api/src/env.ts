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

  // BullMQ queues.
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Seconds between MCP server tool syncs; 0 disables periodic syncs.
  MCP_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(300),
  // MCP server syncs running at once, per API instance.
  MCP_SYNC_CONCURRENCY: z.coerce.number().int().min(1).default(4),

  // Knowledge source: an S3 or S3-compatible bucket (MinIO, R2, ...). Without
  // a bucket or PGVECTOR_URL the knowledge pipeline stays off.
  KNOWLEDGE_S3_ENDPOINT: z.string().optional(), // empty means AWS S3
  KNOWLEDGE_S3_REGION: z.string().default("us-east-1"),
  KNOWLEDGE_S3_BUCKET: z.string().optional(),
  KNOWLEDGE_S3_PREFIX: z.string().default(""),
  // Empty credentials fall back to the AWS default chain (env, profile, IAM role).
  KNOWLEDGE_S3_ACCESS_KEY_ID: z.string().optional(),
  KNOWLEDGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Addresses buckets as endpoint/bucket; most S3-compatible services need it.
  KNOWLEDGE_S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  // Seconds between source syncs; 0 disables periodic syncs.
  KNOWLEDGE_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(300),
  KNOWLEDGE_INDEX_CONCURRENCY: z.coerce.number().int().min(1).default(2),
  CHUNK_MAX_CHARACTERS: z.coerce.number().int().positive().default(1000),
  CHUNK_OVERLAP: z.coerce.number().int().min(0).default(200),

  // Separate Postgres (with pgvector) holding the chunks and their embeddings.
  PGVECTOR_URL: z.string().optional(),
  // Postgres text search config for keyword search. Part of the chunks schema,
  // like EMBEDDING_DIMENSIONS: changing either needs knowledge_chunks dropped
  // and everything reindexed.
  FTS_LANGUAGE: z
    .string()
    .regex(/^[a-z_]+$/)
    .default("simple"),

  // Any OpenAI-compatible embeddings API.
  EMBEDDING_BASE_URL: z.string().default("https://api.openai.com/v1"),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().max(2000).default(1536), // HNSW limit
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(100),

  // Set on release builds; otherwise the short commit hash (see system.service).
  APP_VERSION: z.string().default("dev"),
});

export const env = envSchema.parse(process.env);

export const knowledgeEnabled = Boolean(env.KNOWLEDGE_S3_BUCKET && env.PGVECTOR_URL);
