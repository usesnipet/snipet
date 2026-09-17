-- modify "llm_connections" table
ALTER TABLE "llm_connections" ADD COLUMN "is_default" boolean NOT NULL DEFAULT false;
