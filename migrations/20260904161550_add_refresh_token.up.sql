-- rename a constraint from "llm_providers_pkey" to "llm_connections_pkey"
ALTER TABLE "llm_connections" RENAME CONSTRAINT "llm_providers_pkey" TO "llm_connections_pkey";
-- create "refresh_tokens" table
CREATE TABLE "refresh_tokens" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "revoked_at" timestamp NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_refresh_tokens_hash" to table: "refresh_tokens"
CREATE UNIQUE INDEX "idx_refresh_tokens_hash" ON "refresh_tokens" ("hash");
-- create index "idx_refresh_tokens_user_id" to table: "refresh_tokens"
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");
