-- create "llm_providers" table
CREATE TABLE "llm_providers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "provider" character varying(255) NOT NULL,
  "config" jsonb NOT NULL,
  "enabled" jsonb NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
