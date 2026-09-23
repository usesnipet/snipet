-- create "mcp_servers" table
CREATE TABLE "mcp_servers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "transport" character varying(255) NOT NULL,
  "config" jsonb NOT NULL,
  "last_synced_at" timestamptz NULL,
  "last_synced_error" character varying(255) NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- create "tools" table
CREATE TABLE "tools" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "description" text NOT NULL,
  "input_schema" jsonb NOT NULL,
  "source" character varying(255) NOT NULL,
  "mcp_server_id" uuid NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- create index "idx_tools_mcp_server_id" to table: "tools"
CREATE INDEX "idx_tools_mcp_server_id" ON "tools" ("mcp_server_id");
