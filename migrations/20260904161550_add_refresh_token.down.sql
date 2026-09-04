-- reverse: create index "idx_refresh_tokens_user_id" to table: "refresh_tokens"
DROP INDEX "idx_refresh_tokens_user_id";
-- reverse: create index "idx_refresh_tokens_hash" to table: "refresh_tokens"
DROP INDEX "idx_refresh_tokens_hash";
-- reverse: create "refresh_tokens" table
DROP TABLE "refresh_tokens";
-- reverse: rename a constraint from "llm_providers_pkey" to "llm_connections_pkey"
ALTER TABLE "llm_connections" RENAME CONSTRAINT "llm_connections_pkey" TO "llm_providers_pkey";
