-- create "api_keys" table
CREATE TABLE "api_keys" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "key_id" character varying(255) NOT NULL,
  "key" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "expires_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "uni_api_keys_key" UNIQUE ("key"),
  CONSTRAINT "uni_api_keys_key_id" UNIQUE ("key_id")
);
-- create "llm_connections" table
CREATE TABLE "llm_connections" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "provider" character varying(255) NOT NULL,
  "config" jsonb NOT NULL,
  "enabled" boolean NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- create "agents" table
CREATE TABLE "agents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "system_prompt" text NOT NULL DEFAULT '',
  "max_turns" integer NOT NULL DEFAULT 20,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- create index "idx_agents_name" to table: "agents"
CREATE UNIQUE INDEX "idx_agents_name" ON "agents" ("name");
-- create "agent_llms" table
CREATE TABLE "agent_llms" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL,
  "order" integer NOT NULL,
  "model" character varying(255) NOT NULL,
  "llm_connection_id" uuid NULL,
  "extra_options" jsonb NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_agent_llms_llm_connection" FOREIGN KEY ("llm_connection_id") REFERENCES "llm_connections" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "fk_agents_ll_ms" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_agent_llms_agent_order" to table: "agent_llms"
CREATE UNIQUE INDEX "idx_agent_llms_agent_order" ON "agent_llms" ("agent_id", "order");
-- create index "idx_agent_llms_llm_connection_id" to table: "agent_llms"
CREATE INDEX "idx_agent_llms_llm_connection_id" ON "agent_llms" ("llm_connection_id");
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
-- create "agent_mcp_servers" table
CREATE TABLE "agent_mcp_servers" (
  "agent_id" uuid NOT NULL,
  "mcp_server_id" uuid NOT NULL,
  "allow" jsonb NOT NULL,
  "deny" jsonb NOT NULL,
  PRIMARY KEY ("agent_id", "mcp_server_id"),
  CONSTRAINT "fk_agent_mcp_servers_mcp_server" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_agents_mcp_servers" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create "users" table
CREATE TABLE "users" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "username" character varying(255) NOT NULL,
  "name" character varying(255) NOT NULL,
  "password" character varying(255) NOT NULL,
  "role" character varying(32) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- create index "idx_users_username" to table: "users"
CREATE UNIQUE INDEX "idx_users_username" ON "users" ("username");
-- create "agent_sessions" table
CREATE TABLE "agent_sessions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL,
  "user_id" uuid NULL,
  "subject" character varying(255) NULL,
  "title" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_agent_sessions_agent" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_agent_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_agent_sessions_agent_subject" to table: "agent_sessions"
CREATE INDEX "idx_agent_sessions_agent_subject" ON "agent_sessions" ("agent_id", "subject");
-- create index "idx_agent_sessions_user_id" to table: "agent_sessions"
CREATE INDEX "idx_agent_sessions_user_id" ON "agent_sessions" ("user_id");
-- create "agent_runs" table
CREATE TABLE "agent_runs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL,
  "status" character varying(32) NOT NULL,
  "error" text NOT NULL DEFAULT '',
  "turns" integer NOT NULL DEFAULT 0,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_agent_runs_session" FOREIGN KEY ("session_id") REFERENCES "agent_sessions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_agent_runs_session_id" to table: "agent_runs"
CREATE INDEX "idx_agent_runs_session_id" ON "agent_runs" ("session_id");
-- create index "idx_agent_runs_session_running" to table: "agent_runs"
CREATE UNIQUE INDEX "idx_agent_runs_session_running" ON "agent_runs" ("session_id") WHERE ((status)::text = 'running'::text);
-- create index "idx_agent_runs_status" to table: "agent_runs"
CREATE INDEX "idx_agent_runs_status" ON "agent_runs" ("status");
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
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_tools_mcp_server" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_tools_mcp_server_id" to table: "tools"
CREATE INDEX "idx_tools_mcp_server_id" ON "tools" ("mcp_server_id");
-- create "agent_messages" table
CREATE TABLE "agent_messages" (
  "id" bigserial NOT NULL,
  "session_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "role" character varying(32) NOT NULL,
  "parts" jsonb NOT NULL,
  "model" character varying(255) NULL,
  "input_tokens" integer NULL,
  "output_tokens" integer NULL,
  "tool_id" uuid NULL,
  "duration_ms" bigint NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_agent_messages_run" FOREIGN KEY ("run_id") REFERENCES "agent_runs" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_agent_messages_session" FOREIGN KEY ("session_id") REFERENCES "agent_sessions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_agent_messages_tool" FOREIGN KEY ("tool_id") REFERENCES "tools" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_agent_messages_run_id" to table: "agent_messages"
CREATE INDEX "idx_agent_messages_run_id" ON "agent_messages" ("run_id");
-- create index "idx_agent_messages_session_id" to table: "agent_messages"
CREATE INDEX "idx_agent_messages_session_id" ON "agent_messages" ("session_id", "id");
-- create index "idx_agent_messages_tool_id" to table: "agent_messages"
CREATE INDEX "idx_agent_messages_tool_id" ON "agent_messages" ("tool_id");
-- create "refresh_tokens" table
CREATE TABLE "refresh_tokens" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_refresh_tokens_hash" to table: "refresh_tokens"
CREATE UNIQUE INDEX "idx_refresh_tokens_hash" ON "refresh_tokens" ("hash");
-- create index "idx_refresh_tokens_user_id" to table: "refresh_tokens"
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");
